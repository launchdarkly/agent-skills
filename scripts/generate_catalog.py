#!/usr/bin/env python3
import argparse
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from scripts import validate_skills  # noqa: E402
CATALOG_PATH = ROOT / "skills.json"


def parse_metadata_version(frontmatter_lines: list[str]) -> str | None:
    in_metadata = False
    for line in frontmatter_lines:
        if line.strip() == "metadata:":
            in_metadata = True
            continue
        if in_metadata:
            if not line.startswith((" ", "\t")):
                in_metadata = False
                continue
            if ":" not in line:
                continue
            key, raw_value = line.strip().split(":", 1)
            if key.strip() == "version":
                return validate_skills.normalize_value(raw_value.strip())
    return None


def read_marketplace(skill_dir: pathlib.Path) -> dict:
    marketplace_path = skill_dir / "marketplace.json"
    if not marketplace_path.is_file():
        return {}
    try:
        return json.loads(marketplace_path.read_text(encoding="utf-8"))
    except Exception:
        return {}


def build_catalog() -> dict:
    skill_files = [
        p
        for p in ROOT.rglob(validate_skills.SKILL_GLOB)
        if p.is_file() and not validate_skills.is_excluded(p)
    ]

    catalog_entries = []
    for skill_file in skill_files:
        text = skill_file.read_text(encoding="utf-8")
        lines = text.splitlines()
        parsed, err = validate_skills.parse_frontmatter(lines)
        if err:
            raise ValueError(f"{skill_file.relative_to(ROOT)}: {err}")

        frontmatter_lines, _body_lines = parsed
        fields, _present = validate_skills.parse_frontmatter_fields(frontmatter_lines)

        name = fields.get("name")
        description = fields.get("description")
        license_name = fields.get("license")
        compatibility = fields.get("compatibility")

        if not name or not description:
            raise ValueError(
                f"{skill_file.relative_to(ROOT)}: missing required frontmatter fields"
            )

        metadata_version = parse_metadata_version(frontmatter_lines)
        marketplace = read_marketplace(skill_file.parent)

        entry = {
            "name": name,
            "description": description,
            "path": skill_file.parent.relative_to(ROOT).as_posix(),
        }

        if metadata_version:
            entry["version"] = metadata_version
        elif isinstance(marketplace.get("version"), str):
            entry["version"] = marketplace["version"]

        if license_name:
            entry["license"] = license_name
        if compatibility:
            entry["compatibility"] = compatibility

        tags = marketplace.get("tags")
        if isinstance(tags, list) and tags:
            entry["tags"] = tags

        catalog_entries.append(entry)

    catalog_entries.sort(key=lambda item: item["name"])
    return {"skills": catalog_entries}


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate skills.json catalog.")
    parser.add_argument(
        "--check",
        action="store_true",
        help="Fail if skills.json is out of date.",
    )
    args = parser.parse_args()

    catalog = build_catalog()
    content = json.dumps(catalog, indent=2) + "\n"

    if args.check:
        if not CATALOG_PATH.is_file():
            print("skills.json does not exist.")
            return 1
        existing = CATALOG_PATH.read_text(encoding="utf-8")
        if existing != content:
            print("skills.json is out of date. Run scripts/generate_catalog.py")
            return 1
        print("skills.json is up to date.")
        return 0

    CATALOG_PATH.write_text(content, encoding="utf-8")
    print(f"Wrote {CATALOG_PATH.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
