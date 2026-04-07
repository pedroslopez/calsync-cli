import { Command } from "commander";
import * as store from "../lib/store";

export function registerConfigCommands(program: Command): void {
  const config = program.command("config").description("Manage sync configuration");

  const set = config.command("set").description("Set a configuration value");

  set
    .command("destination <account>")
    .description("Set the destination account for Busy blocks")
    .action((account: string) => {
      const accounts = store.listAccounts();
      if (!accounts.includes(account)) {
        console.error(
          `Account "${account}" not authenticated. Run: calsync auth add ${account}`
        );
        process.exit(1);
      }
      const cfg = store.loadConfig();
      cfg.destinationAccount = account;
      store.saveConfig(cfg);
      console.log(`Destination set to: ${account}`);
    });

  set
    .command("window <days>")
    .description("Set sync window in days (default: 14)")
    .action((days: string) => {
      const n = parseInt(days, 10);
      if (isNaN(n) || n < 1) {
        console.error("Window must be a positive number of days.");
        process.exit(1);
      }
      const cfg = store.loadConfig();
      cfg.syncWindowDays = n;
      store.saveConfig(cfg);
      console.log(`Sync window set to: ${n} days`);
    });

  set
    .command("summary <text>")
    .description('Set blocker event title (default: "Busy")')
    .action((text: string) => {
      const cfg = store.loadConfig();
      cfg.blockerSummary = text;
      store.saveConfig(cfg);
      console.log(`Blocker summary set to: ${text}`);
    });

  set
    .command("description <text>")
    .description('Set blocker event description (default: "Automatically synced by calsync")')
    .action((text: string) => {
      const cfg = store.loadConfig();
      cfg.blockerDescription = text;
      store.saveConfig(cfg);
      console.log(`Blocker description set to: ${text}`);
    });

  set
    .command("skip-allday <bool>")
    .description("Skip all-day events (default: true)")
    .action((bool: string) => {
      const val = bool === "true";
      const cfg = store.loadConfig();
      cfg.skipAllDay = val;
      store.saveConfig(cfg);
      console.log(`Skip all-day events: ${val}`);
    });

  set
    .command("skip-declined <bool>")
    .description("Skip declined events (default: true)")
    .action((bool: string) => {
      const val = bool === "true";
      const cfg = store.loadConfig();
      cfg.skipDeclined = val;
      store.saveConfig(cfg);
      console.log(`Skip declined events: ${val}`);
    });

  config
    .command("show")
    .description("Show current configuration")
    .action(() => {
      const cfg = store.loadConfig();
      console.log(JSON.stringify(cfg, null, 2));
    });

  config
    .command("path")
    .description("Print the config directory path")
    .action(() => {
      console.log(store.getConfigDir());
    });
}
