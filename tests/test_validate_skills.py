import tempfile
import textwrap
import unittest
from pathlib import Path

from scripts import validate_skills


class ValidateSkillsTests(unittest.TestCase):
    def setUp(self):
        self._temp_dirs = []

    def tearDown(self):
        for temp_dir in self._temp_dirs:
            temp_dir.cleanup()

    def test_parse_frontmatter_missing_opening(self):
        lines = ["name: test", "---", "content"]
        parsed, err = validate_skills.parse_frontmatter(lines)
        self.assertIsNone(parsed)
        self.assertIn("opening frontmatter", err)

    def test_parse_frontmatter_missing_closing(self):
        lines = ["---", "name: test", "description: ok"]
        parsed, err = validate_skills.parse_frontmatter(lines)
        self.assertIsNone(parsed)
        self.assertIn("closing frontmatter", err)

    def test_validate_skill_requires_name_and_description(self):
        content = textwrap.dedent(
            """\
            ---
            name: test-skill
            ---

            # Title
            Body
            """
        )
        path = self._write_temp_skill(content)
        errors = validate_skills.validate_skill(path)
        self.assertIn("description", " ".join(errors))

    def test_validate_skill_requires_body(self):
        content = textwrap.dedent(
            """\
            ---
            name: test-skill
            description: ok
            ---
            """
        )
        path = self._write_temp_skill(content)
        errors = validate_skills.validate_skill(path)
        self.assertIn("markdown content", " ".join(errors))

    def test_validate_skill_name_must_match_directory(self):
        content = textwrap.dedent(
            """\
            ---
            name: test-skill
            description: ok
            ---

            # Title
            Body
            """
        )
        path = self._write_temp_skill(content, dir_name="other-skill")
        errors = validate_skills.validate_skill(path)
        self.assertIn("parent directory", " ".join(errors))

    def test_validate_skill_name_constraints(self):
        content = textwrap.dedent(
            """\
            ---
            name: Test-Skill
            description: ok
            ---

            # Title
            Body
            """
        )
        path = self._write_temp_skill(content, dir_name="Test-Skill")
        errors = validate_skills.validate_skill(path)
        self.assertIn("lowercase", " ".join(errors))

    def test_validate_skill_happy_path(self):
        content = textwrap.dedent(
            """\
            ---
            name: test-skill
            description: ok
            ---

            # Title
            Body
            """
        )
        path = self._write_temp_skill(content)
        errors = validate_skills.validate_skill(path)
        self.assertEqual(errors, [])

    def _write_temp_skill(self, content: str, dir_name: str = "test-skill") -> Path:
        temp_dir = tempfile.TemporaryDirectory()
        self._temp_dirs.append(temp_dir)
        skill_dir = Path(temp_dir.name) / dir_name
        skill_dir.mkdir(parents=True, exist_ok=True)
        path = skill_dir / "SKILL.md"
        path.write_text(content, encoding="utf-8")
        return path


if __name__ == "__main__":
    unittest.main()
