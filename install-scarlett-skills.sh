#!/bin/bash
#
# Install LaunchDarkly AI Config Skills from Scarlett Branches
#
# Usage:
#   git clone https://github.com/launchdarkly/agent-skills.git
#   cd agent-skills
#   git checkout scarlett/do-not-merge
#   ./install-scarlett-skills.sh
#

set -e

DEST="${CLAUDE_SKILLS_DIR:-$HOME/.claude/commands}"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  LaunchDarkly AI Config Skills Installer                   ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Fetch latest from remote
echo -e "${YELLOW}Fetching latest branches...${NC}"
git fetch origin --quiet
echo ""

# Create destination directory
mkdir -p "$DEST"
echo -e "${GREEN}Installing to:${NC} $DEST"
echo ""

install_skill() {
  local branch="$1"
  local skill_path="$2"
  local skill_name=$(basename "$skill_path")

  echo -e "  ${YELLOW}→${NC} $skill_name"

  # Extract SKILL.md using git show (no checkout needed)
  git show "${branch}:skills/${skill_path}/SKILL.md" > "$DEST/${skill_name}.md" 2>/dev/null || {
    echo -e "    ${YELLOW}(not found)${NC}"
    return
  }

  # Check for references directory and extract if exists
  local refs=$(git ls-tree --name-only "$branch" "skills/$skill_path/references/" 2>/dev/null || true)
  if [ -n "$refs" ]; then
    mkdir -p "$DEST/${skill_name}-references"
    for ref_file in $refs; do
      local filename=$(basename "$ref_file")
      git show "${branch}:skills/${skill_path}/references/${filename}" > "$DEST/${skill_name}-references/$filename" 2>/dev/null || true
    done
  fi
}

install_from_branch() {
  local branch="$1"
  shift
  local skills="$@"

  echo -e "${BLUE}Branch: ${branch#origin/}${NC}"
  for skill in $skills; do
    install_skill "$branch" "$skill"
  done
  echo ""
}

# Install from each scarlett branch
install_from_branch "origin/scarlett/aiconfig-1-foundation" \
  "ai-configs/aiconfig-projects"

install_from_branch "origin/scarlett/aiconfig-2-create-manage" \
  "ai-configs/aiconfig-create" \
  "ai-configs/aiconfig-tools" \
  "ai-configs/aiconfig-update" \
  "ai-configs/aiconfig-variations"

install_from_branch "origin/scarlett/aiconfig-3-sdk-usage" \
  "ai-configs/aiconfig-context-advanced" \
  "ai-configs/aiconfig-context-basic" \
  "ai-configs/aiconfig-sdk"

install_from_branch "origin/scarlett/aiconfig-4-targeting" \
  "ai-configs/aiconfig-segments" \
  "ai-configs/aiconfig-targeting"

install_from_branch "origin/scarlett/aiconfig-5-metrics" \
  "ai-configs/aiconfig-ai-metrics" \
  "ai-configs/aiconfig-custom-metrics" \
  "ai-configs/aiconfig-online-evals"

install_from_branch "origin/scarlett/aiconfig-6-api" \
  "ai-configs/aiconfig-api"

# Install stable skills from main
install_from_branch "origin/main" \
  "feature-flags/launchdarkly-flag-cleanup" \
  "skill-authoring/create-skill"

# Summary
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  Installation Complete!                                    ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "Installed skills:"
ls -1 "$DEST"/*.md 2>/dev/null | xargs -I {} basename {} .md | sed 's/^/  ✓ /'
echo ""
echo -e "${YELLOW}Note:${NC} These skills are from development branches and may change."
echo -e "For production use, wait for skills to be merged to main."
echo ""
