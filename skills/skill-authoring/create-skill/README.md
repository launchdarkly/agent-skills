# Create Skill (LaunchDarkly)

This skill guides adding new skills to the LaunchDarkly agent-skills repository. It follows the same workflow pattern as other skills: explore existing skills, assess what's needed, create following conventions, and verify with validation scripts.

## Overview

The workflow covers:
- Exploring existing skills to understand patterns
- Assessing category, name, and structure
- Creating `SKILL.md` from the template with job-to-be-done workflow
- Adding references for detailed content
- Updating `README.md` and regenerating the catalog
- Validating with `scripts/validate_skills.py`

## Usage

Ask:

```
Add a new skill for <workflow> in the LaunchDarkly agent-skills repo
```

## Structure

```
create-skill/
├── SKILL.md
├── README.md
└── references/
    ├── skill-structure.md
    └── frontmatter.md
```

## Related

- [Agent Skills Specification](https://agentskills.io/specification)
- [skills.sh](https://skills.sh/)
