import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import yaml from "js-yaml";
import type { SkillDefinition } from "./types";

interface OpenAiYaml {
  policy?: {
    allow_implicit_invocation?: boolean;
  };
}

export function loadSkillRegistry(rootDir = path.resolve(process.cwd(), ".agents/skills")): Map<string, SkillDefinition> {
  rootDir = resolveSkillsRoot(rootDir);
  const registry = new Map<string, SkillDefinition>();

  if (!fs.existsSync(rootDir)) {
    return registry;
  }

  for (const entry of fs.readdirSync(rootDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }

    const skillDir = path.join(rootDir, entry.name);
    const skillMdPath = path.join(skillDir, "SKILL.md");
    if (!fs.existsSync(skillMdPath)) {
      continue;
    }

    const raw = fs.readFileSync(skillMdPath, "utf8");
    const parsed = matter(raw);
    const name = String(parsed.data.name ?? "").trim();
    const description = String(parsed.data.description ?? "").trim();

    if (!name || !description) {
      continue;
    }

    const openAiYamlPath = path.join(skillDir, "agents", "openai.yaml");
    let allowImplicit = true;

    if (fs.existsSync(openAiYamlPath)) {
      try {
        const openAiYamlRaw = fs.readFileSync(openAiYamlPath, "utf8");
        const openAiYaml = yaml.load(openAiYamlRaw) as OpenAiYaml;
        allowImplicit = openAiYaml?.policy?.allow_implicit_invocation ?? true;
      } catch {
        allowImplicit = true;
      }
    }

    registry.set(name, {
      name,
      description,
      body: inlineReferences(parsed.content.trim(), skillDir),
      allowImplicitInvocation: allowImplicit,
      path: skillDir
    });
  }

  return registry;
}

// The LLM only ever sees SKILL.md, so a skill that links to references/*.md
// would silently lose those rules. Every referenced file is appended to the
// body, which keeps SKILL.md readable while the model still gets everything.
function inlineReferences(body: string, skillDir: string): string {
  const seen = new Set<string>();
  const sections: string[] = [];

  for (const match of body.matchAll(/\]\((references\/[\w.-]+\.md)\)/g)) {
    const relativePath = match[1];
    if (seen.has(relativePath)) continue;
    seen.add(relativePath);

    const absolutePath = path.join(skillDir, relativePath);
    if (!fs.existsSync(absolutePath)) continue;

    sections.push(`## Reference: ${relativePath}\n\n${fs.readFileSync(absolutePath, "utf8").trim()}`);
  }

  return sections.length ? `${body}\n\n---\n\n${sections.join("\n\n---\n\n")}` : body;
}

function resolveSkillsRoot(initialPath: string): string {
  if (fs.existsSync(initialPath)) {
    return initialPath;
  }

  let current = process.cwd();
  for (let depth = 0; depth < 6; depth += 1) {
    const candidate = path.resolve(current, ".agents/skills");
    if (fs.existsSync(candidate)) {
      return candidate;
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }

  return initialPath;
}
