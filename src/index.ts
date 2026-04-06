#!/usr/bin/env node

import { program } from "commander";
import { registerAuthCommands } from "./commands/auth";
import { registerSourceCommands } from "./commands/source";
import { registerConfigCommands } from "./commands/config";
import { registerSyncCommand } from "./commands/sync";

program
  .name("calsync")
  .description(
    "Sync personal Google Calendar events as Busy blocks on your work calendar"
  )
  .version("1.0.0");

registerAuthCommands(program);
registerSourceCommands(program);
registerConfigCommands(program);
registerSyncCommand(program);

program.parse();
