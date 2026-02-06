#!/bin/bash
#
# Install LaunchDarkly AI Config Skills from Scarlett Branches
#
# Usage:
#   git clone https://github.com/launchdarkly/agent-skills.git
#   cd agent-skills
#   git checkout scarlett/do-not-merge
#   ./install-scarlett-skills.sh [--global|--local]
#
# Options:
#   --global  Install to ~/.claude/skills (available everywhere)
#   --local   Install to ./.claude/skills (current project only)
#

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Parse arguments
INSTALL_MODE=""
while [[ $# -gt 0 ]]; do
  case $1 in
    --global)
      INSTALL_MODE="global"
      shift
      ;;
    --local)
      INSTALL_MODE="local"
      shift
      ;;
    *)
      echo "Unknown option: $1"
      echo "Usage: ./install-scarlett-skills.sh [--global|--local]"
      exit 1
      ;;
  esac
done

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  LaunchDarkly AI Config Skills Installer                   ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# If no mode specified, ask user
if [ -z "$INSTALL_MODE" ]; then
  echo -e "Where would you like to install the skills?"
  echo ""
  echo -e "  ${GREEN}1)${NC} Global  (~/.claude/skills) - available in all projects"
  echo -e "  ${GREEN}2)${NC} Local   (./.claude/skills) - current project only"
  echo ""
  read -p "Enter choice [1/2]: " choice
  case $choice in
    1) INSTALL_MODE="global" ;;
    2) INSTALL_MODE="local" ;;
    *) echo "Invalid choice. Defaulting to global."; INSTALL_MODE="global" ;;
  esac
  echo ""
fi

# Set destination based on mode
if [ "$INSTALL_MODE" = "local" ]; then
  DEST="./.claude/skills"
else
  DEST="$HOME/.claude/skills"
fi

# Allow override via environment variable
DEST="${CLAUDE_SKILLS_DIR:-$DEST}"

# Fetch latest from remote
echo -e "${YELLOW}Fetching latest branches...${NC}"
git fetch origin --quiet
echo ""

# Create destination directory
mkdir -p "$DEST"
echo -e "${GREEN}Installing to:${NC} $DEST"
echo ""

# Track installed skills
INSTALLED_SKILLS=()

install_skill() {
  local branch="$1"
  local skill_path="$2"
  local skill_name=$(basename "$skill_path")
  local skill_dir="$DEST/$skill_name"

  echo -e "  ${YELLOW}→${NC} $skill_name"

  # Create skill directory
  mkdir -p "$skill_dir"

  # Extract SKILL.md using git show (no checkout needed)
  if ! git show "${branch}:skills/${skill_path}/SKILL.md" > "$skill_dir/SKILL.md" 2>/dev/null; then
    echo -e "    ${RED}(SKILL.md not found)${NC}"
    rmdir "$skill_dir" 2>/dev/null || true
    return
  fi

  INSTALLED_SKILLS+=("$skill_name")

  # Check for references directory and extract if exists
  local refs=$(git ls-tree --name-only "$branch" "skills/$skill_path/references/" 2>/dev/null || true)
  if [ -n "$refs" ]; then
    mkdir -p "$skill_dir/references"
    for ref_file in $refs; do
      local filename=$(basename "$ref_file")
      git show "${branch}:skills/${skill_path}/references/${filename}" > "$skill_dir/references/$filename" 2>/dev/null || true
    done
    local ref_count=$(ls -1 "$skill_dir/references" 2>/dev/null | wc -l | tr -d ' ')
    echo -e "    ${GREEN}+ ${ref_count} reference file(s)${NC}"
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
echo -e "Installed ${#INSTALLED_SKILLS[@]} skills:"
for skill in "${INSTALLED_SKILLS[@]}"; do
  echo -e "  ${GREEN}✓${NC} $skill"
done
echo ""
if [ "$INSTALL_MODE" = "local" ]; then
  echo -e "${GREEN}Usage:${NC} Skills are available in this project"
else
  echo -e "${GREEN}Usage:${NC} Skills are available globally"
fi
echo ""
echo -e "Invoke skills with: ${BLUE}/skill-name${NC} (e.g., /aiconfig-create)"
echo ""
echo -e "${YELLOW}Note:${NC} These skills are from development branches and may change."
echo -e "For production use, wait for skills to be merged to main."
echo ""
