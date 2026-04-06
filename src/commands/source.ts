import { Command } from "commander";
import * as store from "../lib/store";

export function registerSourceCommands(program: Command): void {
  const source = program.command("source").description("Manage source calendars to sync from");

  source
    .command("add <account>")
    .description("Add a source calendar")
    .option("--calendar-id <id>", "Calendar ID to sync from", "primary")
    .action((account: string, opts: { calendarId: string }) => {
      const accounts = store.listAccounts();
      if (!accounts.includes(account)) {
        console.error(
          `Account "${account}" not authenticated. Run: calsync auth add ${account}`
        );
        process.exit(1);
      }

      const config = store.loadConfig();
      const exists = config.sources.some(
        (s) => s.account === account && s.calendarId === opts.calendarId
      );
      if (exists) {
        console.log(
          `Source "${account}" (calendar: ${opts.calendarId}) is already configured.`
        );
        return;
      }

      config.sources.push({ account, calendarId: opts.calendarId });
      store.saveConfig(config);
      console.log(`Added source: ${account} (calendar: ${opts.calendarId})`);
    });

  source
    .command("list")
    .description("List configured source calendars")
    .action(() => {
      const config = store.loadConfig();
      if (config.sources.length === 0) {
        console.log("No source calendars configured. Run: calsync source add <account>");
        return;
      }
      console.log("Source calendars:");
      for (const s of config.sources) {
        console.log(`  - ${s.account} (calendar: ${s.calendarId})`);
      }
    });

  source
    .command("remove <account>")
    .description("Remove a source calendar")
    .action((account: string) => {
      const config = store.loadConfig();
      const before = config.sources.length;
      config.sources = config.sources.filter((s) => s.account !== account);
      if (config.sources.length === before) {
        console.error(`Source "${account}" not found.`);
        process.exit(1);
      }
      store.saveConfig(config);
      console.log(`Removed source: ${account}`);
    });
}
