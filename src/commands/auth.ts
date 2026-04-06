import fs from "fs";
import path from "path";
import { Command } from "commander";
import * as store from "../lib/store";
import { runAuthFlow } from "../lib/oauth";

export function registerAuthCommands(program: Command): void {
  const auth = program.command("auth").description("Manage Google account authentication");

  auth
    .command("setup <credentials-path>")
    .description("Set up Google Cloud OAuth credentials")
    .action((credentialsPath: string) => {
      const resolved = path.resolve(credentialsPath);
      if (!fs.existsSync(resolved)) {
        console.error(`File not found: ${resolved}`);
        process.exit(1);
      }

      const raw = JSON.parse(fs.readFileSync(resolved, "utf-8"));
      if (!raw.installed && !raw.web) {
        console.error(
          "Invalid credentials file. Download an OAuth 2.0 Client ID (Desktop app) from Google Cloud Console."
        );
        process.exit(1);
      }

      const dest = store.getCredentialsPath();
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(resolved, dest);
      console.log(`Credentials saved to ${dest}`);
    });

  auth
    .command("add <name>")
    .description("Add a Google account via OAuth")
    .action(async (name: string) => {
      const existing = store.listAccounts();
      if (existing.includes(name)) {
        console.log(`Account "${name}" already exists. Tokens will be refreshed.`);
      }

      try {
        const email = await runAuthFlow(name);
        console.log(`Account "${name}" authenticated as ${email}`);
      } catch (err: any) {
        console.error(`Authentication failed: ${err.message}`);
        process.exit(1);
      }
    });

  auth
    .command("list")
    .description("List configured accounts")
    .action(() => {
      const accounts = store.listAccounts();
      if (accounts.length === 0) {
        console.log("No accounts configured. Run: calsync auth add <name>");
        return;
      }
      console.log("Configured accounts:");
      for (const name of accounts) {
        console.log(`  - ${name}`);
      }
    });

  auth
    .command("remove <name>")
    .description("Remove an account")
    .action((name: string) => {
      if (!store.removeTokens(name)) {
        console.error(`Account "${name}" not found.`);
        process.exit(1);
      }

      // Warn if referenced in config
      const config = store.loadConfig();
      const isSource = config.sources.some((s) => s.account === name);
      const isDest = config.destinationAccount === name;
      if (isSource || isDest) {
        console.log(
          `Warning: "${name}" is referenced in your config as a ${isSource ? "source" : "destination"}. Update your config.`
        );
      }

      console.log(`Account "${name}" removed.`);
    });
}
