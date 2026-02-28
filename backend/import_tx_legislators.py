#!/usr/bin/env python3
"""
Import Texas legislators from CSV into the cache table
This bypasses the OpenStates API limit by using bulk data
"""

import csv
import json
import hashlib
import requests
from datetime import datetime, timedelta

# Supabase configuration
SUPABASE_URL = "https://yurdvlcxednoaikrljbh.supabase.co"
SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl1cmR2bGN4ZWRub2Fpa3JsamJoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcyMjA4MTIsImV4cCI6MjA3Mjc5NjgxMn0.MJrIO2Txxfyi6VtHKOH0-2R62fTYGLvpQnvEHkpTXdg"

def read_tx_legislators(csv_path):
    """Read Texas legislators from CSV file"""
    legislators = []
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            # Convert to OpenStates-like format
            legislator = {
                "id": row["id"],
                "name": row["name"],
                "given_name": row["given_name"],
                "family_name": row["family_name"],
                "party": row["current_party"],
                "current_chamber": row["current_chamber"],
                "current_district": row["current_district"],
                "email": row["email"],
                "image": row["image"],
                "gender": row["gender"],
                "capitol_address": row["capitol_address"],
                "capitol_voice": row["capitol_voice"],
                "district_address": row["district_address"],
                "district_voice": row["district_voice"],
                "twitter": row["twitter"],
                "facebook": row["facebook"],
                "current_role": {
                    "title": "Senator" if row["current_chamber"] == "upper" else "Representative",
                    "chamber": row["current_chamber"],
                    "district": row["current_district"],
                    "jurisdiction_id": "ocd-jurisdiction/country:us/state:tx/government"
                },
                "jurisdiction": {
                    "id": "ocd-jurisdiction/country:us/state:tx/government",
                    "name": "Texas",
                    "classification": "state"
                }
            }
            legislators.append(legislator)
    return legislators

def create_cache_entry(zipcode="78701"):
    """Create a cache entry for Texas legislators"""
    legislators = read_tx_legislators("/Users/officeimac/Downloads/tx.csv")

    # Convert to EnhancedMember format that frontend expects
    enhanced_members = []
    for legislator in legislators:
        # Determine chamber
        chamber = "Senate" if legislator["current_chamber"] == "upper" else "House"

        # Create bioguide ID similar to frontend logic
        name_part = legislator["name"].lower().replace(" ", "").replace(".", "")[:20]
        title_part = chamber.lower()[:10]
        bioguide_id = f"os-state-{title_part}-{name_part}"[:50]

        enhanced_member = {
            "bioguide_id": bioguide_id,
            "member_id": bioguide_id,
            "full_name": legislator["name"],
            "party": legislator["party"],
            "chamber": chamber,
            "state": "TX",
            "district": legislator["current_district"],
            "office_name": "Senator" if chamber == "Senate" else "Representative",
            "level": "state",
            "division_id": "ocd-jurisdiction/country:us/state:tx/government",
            "photo_url": legislator.get("image", ""),
            "phone": legislator.get("capitol_voice", ""),
            "email": legislator.get("email", ""),
            "website": None,
            "social_media": {
                "twitter": legislator.get("twitter", ""),
                "facebook": legislator.get("facebook", "")
            } if legislator.get("twitter") or legislator.get("facebook") else None,
            "in_office": True,
            "next_election": None,
            "created_at": datetime.utcnow().isoformat() + "Z",
            "updated_at": datetime.utcnow().isoformat() + "Z"
        }
        enhanced_members.append(enhanced_member)

    # Create the response format that representativeService expects
    response_data = {
        "federal": [],
        "state": enhanced_members,
        "local": [],
        "raw": {
            "source": "OpenStates Bulk Data (CSV Import)",
            "zipcode": zipcode,
            "totalFound": len(enhanced_members),
            "localOfficialsCount": 0,
            "apiWorking": False
        }
    }

    # Create cache key (matches what the frontend creates)
    cache_key = f"openstates_all_{zipcode}"

    # Generate hash for key field
    key_hash = hashlib.sha256(cache_key.encode()).hexdigest()

    # Set expiry for 30 days (since legislator data is stable)
    now = datetime.utcnow()
    expires_at = now + timedelta(days=30)

    cache_entry = {
        "key": key_hash,
        "source": "openstates",
        "url": f"https://v3.openstates.org/people",
        "params": {"zipcode": zipcode},
        "status": 200,
        "body": response_data,
        "fetched_at": now.isoformat() + "Z",
        "expires_at": expires_at.isoformat() + "Z",
        "last_accessed": now.isoformat() + "Z"
    }

    return cache_entry

def insert_to_supabase(cache_entry):
    """Insert cache entry into Supabase"""
    headers = {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
    }

    response = requests.post(
        f"{SUPABASE_URL}/rest/v1/api_cache",
        headers=headers,
        json=cache_entry
    )

    if response.status_code in [200, 201]:
        print(f"✅ Successfully inserted cache entry with key: {cache_entry['key']}")
    else:
        print(f"❌ Failed to insert: {response.status_code}")
        print(response.text)

def main():
    print("🚀 Importing Texas legislators into cache...")

    # Create cache entries for different Texas zipcodes
    texas_zipcodes = ["78701", "75001", "75205", "77001", "78201", "79901"]  # Austin, Dallas (including 75205), Houston, San Antonio, El Paso

    for zipcode in texas_zipcodes:
        print(f"📍 Creating cache for zipcode {zipcode}...")
        cache_entry = create_cache_entry(zipcode)

        print(f"📦 Created cache entry with {len(cache_entry['body']['state'])} state legislators")

        # Insert into Supabase
        insert_to_supabase(cache_entry)

    print("✨ Import complete!")

if __name__ == "__main__":
    main()