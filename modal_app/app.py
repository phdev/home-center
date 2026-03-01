"""
Modal serverless GPU app for 3D Gaussian Splatting (splatfacto) training.

Replaces RunPod GPU pods with true serverless — no pod management, no Jupyter,
no Docker pulls. Just deploy once and call the HTTP endpoints.

Deploy:
    pip install modal
    modal setup          # one-time auth
    modal deploy app.py  # deploys to Modal cloud

After deployment, Modal prints the web endpoint URL. Set that as MODAL_URL
in your Cloudflare Worker secrets:
    cd ../worker && wrangler secret put MODAL_URL
    # paste: https://<workspace>--accel-driv-3dgs-web.modal.run

Endpoints (same interface as the old RunPod pod server):
    GET  /health                  → {"ok": true}
    POST /train                   → {"started": true, "job_id": "j-abc12345"}
    GET  /status?job_id=j-abc123  → {"state": "training", "progress": "42% of 7000"}
    GET  /result?job_id=j-abc123  → binary PLY file
    POST /cleanup?job_id=j-abc123 → {"cleaned": true}
"""

import modal
import uuid

app = modal.App("accel-driv-3dgs")

# ---------------------------------------------------------------------------
# Container image: nerfstudio with ns-train / ns-export / gsplat pre-installed
# ---------------------------------------------------------------------------
nerfstudio_image = (
    modal.Image.from_registry("dromni/nerfstudio:1.1.5", add_python="3.10")
    .pip_install("starlette")
)

web_image = modal.Image.debian_slim(python_version="3.10").pip_install("starlette")

# ---------------------------------------------------------------------------
# Shared state
# ---------------------------------------------------------------------------
training_status = modal.Dict.from_name("accel-driv-status", create_if_missing=True)
results_vol = modal.Volume.from_name("accel-driv-results", create_if_missing=True)

# ---------------------------------------------------------------------------
# GPU training function (runs on A10G / A100 / T4)
# ---------------------------------------------------------------------------
@app.function(
    gpu="A10G",
    image=nerfstudio_image,
    timeout=3600,
    volumes={"/results": results_vol},
)
def run_training(job_id: str, iterations: int = 7000):
    import json, base64, os, subprocess, glob, shutil

    results_vol.reload()
    input_dir = f"/results/{job_id}/input"

    if not os.path.exists(input_dir):
        training_status[job_id] = {"state": "failed", "error": "Input data not found on volume"}
        return

    # Copy input to nerfstudio working directory
    os.makedirs("/workspace/data/images", exist_ok=True)
    shutil.copy2(f"{input_dir}/transforms.json", "/workspace/data/transforms.json")
    for img in os.listdir(f"{input_dir}/images"):
        shutil.copy2(f"{input_dir}/images/{img}", f"/workspace/data/images/{img}")

    frame_count = len(os.listdir("/workspace/data/images"))
    print(f"Loaded {frame_count} frames from volume, training {iterations} iters...")
    training_status[job_id] = {"state": "training", "progress": f"0/{iterations}", "frames": frame_count}

    proc = subprocess.Popen(
        [
            "ns-train", "splatfacto",
            "--data", "/workspace/data",
            "--max-num-iterations", str(iterations),
            "--output-dir", "/workspace/ns-output",
            "--vis", "none",
            "--pipeline.datamanager.dataparser", "nerfstudio-data",
            "--pipeline.model.num-downscales", "0",
        ],
        stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True
    )

    last_lines = []
    for line in proc.stdout:
        line = line.strip()
        if line:
            last_lines = (last_lines + [line])[-20:]
        if "%" in line:
            try:
                progress = line.split("%")[0].split("(")[-1].strip() + f"% of {iterations}"
                training_status[job_id] = {"state": "training", "progress": progress, "frames": frame_count}
            except Exception:
                pass
        elif "step" in line.lower() or "iter" in line.lower():
            training_status[job_id] = {"state": "training", "progress": line[:80], "frames": frame_count}

    proc.wait()
    if proc.returncode != 0:
        tail = "\n".join(last_lines[-5:])
        training_status[job_id] = {"state": "failed", "error": f"ns-train exited {proc.returncode}: {tail}"}
        return

    # Export gaussian splat PLY
    training_status[job_id] = {"state": "exporting"}
    configs = glob.glob("/workspace/ns-output/**/splatfacto/**/config.yml", recursive=True)
    if not configs:
        training_status[job_id] = {"state": "failed", "error": "No config.yml found after training"}
        return

    subprocess.run(
        ["ns-export", "gaussian-splat", "--load-config", configs[0], "--output-dir", "/workspace/export"],
        check=True
    )

    pp = "/workspace/export/splat.ply"
    if not os.path.exists(pp):
        plys = glob.glob("/workspace/export/**/*.ply", recursive=True)
        pp = plys[0] if plys else None
    if not pp:
        training_status[job_id] = {"state": "failed", "error": "No PLY output after export"}
        return

    # Copy PLY to results volume
    out_dir = f"/results/{job_id}/output"
    os.makedirs(out_dir, exist_ok=True)
    shutil.copy2(pp, f"{out_dir}/splat.ply")
    results_vol.commit()

    mb = os.path.getsize(pp) / 1e6
    training_status[job_id] = {"state": "completed", "size_mb": round(mb, 1)}
    print(f"Done! PLY: {mb:.1f} MB → /results/{job_id}/output/splat.ply")

    # Clean up input data from volume (keep output)
    shutil.rmtree(f"/results/{job_id}/input", ignore_errors=True)
    results_vol.commit()


# ---------------------------------------------------------------------------
# ASGI web app — single URL, same /train /status /result interface as RunPod
# ---------------------------------------------------------------------------
@app.function(
    image=web_image,
    volumes={"/results": results_vol},
    allow_concurrent_inputs=20,
)
@modal.asgi_app(label="accel-driv-3dgs-web")
def web():
    from starlette.applications import Starlette
    from starlette.routing import Route
    from starlette.requests import Request
    from starlette.responses import JSONResponse, Response
    from starlette.middleware import Middleware
    import json, base64, os

    # -- CORS middleware --
    from starlette.middleware.base import BaseHTTPMiddleware

    class CORSMiddleware(BaseHTTPMiddleware):
        async def dispatch(self, request, call_next):
            if request.method == "OPTIONS":
                return Response(status_code=204, headers={
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
                    "Access-Control-Allow-Headers": "*",
                    "Access-Control-Max-Age": "86400",
                })
            response = await call_next(request)
            response.headers["Access-Control-Allow-Origin"] = "*"
            response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
            response.headers["Access-Control-Allow-Headers"] = "*"
            return response

    # -- Routes --
    async def health(request: Request):
        return JSONResponse({"ok": True})

    async def train(request: Request):
        body = await request.json()
        frames = body.get("frames", [])
        transforms = body.get("transforms", {})
        iterations = body.get("iterations", 7000)

        job_id = "j-" + uuid.uuid4().hex[:8]
        training_status[job_id] = {"state": "preparing", "frames": len(frames)}

        # Write frames to volume so the GPU function can read them
        input_dir = f"/results/{job_id}/input"
        os.makedirs(f"{input_dir}/images", exist_ok=True)
        with open(f"{input_dir}/transforms.json", "w") as f:
            json.dump(transforms, f)
        for fr in frames:
            with open(f"{input_dir}/images/{fr['name']}", "wb") as f:
                f.write(base64.b64decode(fr["b64"]))
        results_vol.commit()

        # Spawn GPU training (returns immediately)
        run_training.spawn(job_id, iterations)

        return JSONResponse({"started": True, "job_id": job_id})

    async def status(request: Request):
        job_id = request.query_params.get("job_id", "")
        if not job_id:
            return JSONResponse({"error": "missing job_id"}, status_code=400)
        st = training_status.get(job_id, {"state": "unknown"})
        return JSONResponse(st)

    async def result(request: Request):
        job_id = request.query_params.get("job_id", "")
        if not job_id:
            return JSONResponse({"error": "missing job_id"}, status_code=400)
        results_vol.reload()
        path = f"/results/{job_id}/output/splat.ply"
        if not os.path.exists(path):
            return JSONResponse({"error": "not ready"}, status_code=404)
        with open(path, "rb") as f:
            data = f.read()
        return Response(
            content=data,
            media_type="application/octet-stream",
            headers={"Content-Disposition": "attachment; filename=splat.ply"}
        )

    async def cleanup(request: Request):
        body = await request.json()
        job_id = body.get("job_id", "")
        if not job_id:
            return JSONResponse({"error": "missing job_id"}, status_code=400)
        import shutil
        shutil.rmtree(f"/results/{job_id}", ignore_errors=True)
        results_vol.commit()
        try:
            del training_status[job_id]
        except Exception:
            pass
        return JSONResponse({"cleaned": True})

    return Starlette(
        routes=[
            Route("/health", health, methods=["GET"]),
            Route("/train", train, methods=["POST", "OPTIONS"]),
            Route("/status", status, methods=["GET"]),
            Route("/result", result, methods=["GET"]),
            Route("/cleanup", cleanup, methods=["POST"]),
        ],
        middleware=[Middleware(CORSMiddleware)],
    )
