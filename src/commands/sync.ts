import { Command } from "commander";
import * as store from "../lib/store";
import { executeSync } from "../lib/sync";

export function registerSyncCommand(program: Command): void {
  program
    .command("sync")
    .description("Sync source calendar events as Busy blocks on destination calendar")
    .option("--dry-run", "Preview changes without modifying the destination calendar")
    .action(async (opts: { dryRun?: boolean }) => {
      const config = store.loadConfig();

      if (config.sources.length === 0) {
        console.error("No source calendars configured. Run: calsync source add <account>");
        process.exit(1);
      }
      if (!config.destinationAccount) {
        console.error(
          "No destination account configured. Run: calsync config set destination <account>"
        );
        process.exit(1);
      }

      // Verify all accounts exist
      const accounts = store.listAccounts();
      for (const source of config.sources) {
        if (!accounts.includes(source.account)) {
          console.error(
            `Source account "${source.account}" not authenticated. Run: calsync auth add ${source.account}`
          );
          process.exit(1);
        }
      }
      if (!accounts.includes(config.destinationAccount)) {
        console.error(
          `Destination account "${config.destinationAccount}" not authenticated. Run: calsync auth add ${config.destinationAccount}`
        );
        process.exit(1);
      }

      const timestamp = new Date().toISOString();
      console.log(`\n[${timestamp}] calsync starting...`);

      if (opts.dryRun) {
        console.log("Dry run — no changes will be made:\n");
      }

      try {
        const result = await executeSync(config, !!opts.dryRun);

        console.log(
          `[${timestamp}] ${opts.dryRun ? "Would sync" : "Synced"}: ` +
            `${result.created} created, ${result.updated} updated, ${result.deleted} deleted`
        );

        if (result.errors.length > 0) {
          console.error(`\nErrors (${result.errors.length}):`);
          for (const err of result.errors) {
            console.error(`  - ${err}`);
          }
          process.exit(1);
        }
      } catch (err: any) {
        console.error(`Sync failed: ${err.message}`);
        process.exit(1);
      }
    });
}
