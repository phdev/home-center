"""Classification prompt templates for email triage."""

CATEGORIES = [
    "school",
    "medical",
    "activities",
    "household",
    "travel",
    "family_events",
    "deliveries",
    "government",
    "finance",
    "not_relevant",
]

CATEGORY_DESCRIPTIONS = {
    "school": "report cards, newsletters, field trips, parent-teacher, snow days, school events",
    "medical": "appointments, lab results, prescriptions, insurance EOBs, pediatrician",
    "activities": "sports schedules, recitals, practice, lessons, camps, extracurriculars",
    "household": "utility bills, insurance, HOA, home maintenance, property tax",
    "travel": "flight confirmations, hotel bookings, itineraries, rental cars",
    "family_events": "party invites, reunions, holidays, birthdays, anniversaries",
    "deliveries": "package tracking, shipping confirmations, delivery notifications",
    "government": "DMV, passport, tax documents, jury duty, voter registration",
    "finance": "bank alerts, credit card statements, investment updates (family accounts)",
    "not_relevant": "work emails, marketing, newsletters, social media notifications, spam",
}

# Optimized for small models: structured, few-shot, under 512 tokens
LOCAL_SYSTEM_PROMPT = """You classify emails as family-relevant or not.

Reply ONLY with valid JSON: {"relevant": true/false, "confidence": 0.0-1.0}

Examples:
From: school@district.org | Subject: Snow day tomorrow -> {"relevant": true, "confidence": 0.95}
From: noreply@linkedin.com | Subject: 5 new connections -> {"relevant": false, "confidence": 0.98}
From: pediatrics@clinic.com | Subject: Appointment reminder -> {"relevant": true, "confidence": 0.92}
From: promo@store.com | Subject: 50% off sale -> {"relevant": false, "confidence": 0.99}
From: tracking@fedex.com | Subject: Your package is arriving -> {"relevant": true, "confidence": 0.85}"""

LOCAL_USER_TEMPLATE = """From: {from_name} <{from_addr}>
Subject: {subject}
Snippet: {snippet}"""

CLOUD_SYSTEM_PROMPT = """You are an email triage assistant for a family household. Classify the email into exactly one category and generate a short summary.

Categories:
- school: {school}
- medical: {medical}
- activities: {activities}
- household: {household}
- travel: {travel}
- family_events: {family_events}
- deliveries: {deliveries}
- government: {government}
- finance: {finance}
- not_relevant: {not_relevant}

Reply ONLY with valid JSON:
{{"category": "<category>", "confidence": 0.0-1.0, "summary": "<one-line summary for family notification>"}}

The summary should be concise (under 100 characters), actionable, and written for a family member glancing at a notification. Include key details like dates, times, or action items.""".format(**CATEGORY_DESCRIPTIONS)

CLOUD_USER_TEMPLATE = """From: {from_name} <{from_addr}>
Subject: {subject}
Date: {date}
Body:
{body}"""
