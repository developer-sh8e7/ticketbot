const fs = require('fs');
const path = require('path');

const sourceDir = path.join(__dirname, '../BotGames');
const targetDir = path.join(__dirname, '../discord-bot');

const fileMapping = {
  'package.json': 'package.json',
  'tsconfig.json': 'tsconfig.json',
  'env.example': '.env.example',
  
  'index.ts': 'src/index.ts',
  'config.ts': 'src/config.ts',
  'types.ts': 'src/types.ts',
  'deploy.ts': 'src/deploy.ts',
  
  'database.ts': 'src/utils/database.ts',
  'embed.ts': 'src/utils/embed.ts',
  'logger.ts': 'src/utils/logger.ts',
  
  'commandHandler.ts': 'src/handlers/commandHandler.ts',
  'eventHandler.ts': 'src/handlers/eventHandler.ts',
  
  'ready.ts': 'src/events/ready.ts',
  'interactionCreate.ts': 'src/events/interactionCreate.ts',
  'guildMemberAdd.ts': 'src/events/guildMemberAdd.ts',
  'guildMemberRemove.ts': 'src/events/guildMemberRemove.ts',
  
  'setup.ts': 'src/commands/system/setup.ts',
  'rules.ts': 'src/commands/system/rules.ts',
  
  'bomb.ts': 'src/commands/games/bomb.ts',
  'guess.ts': 'src/commands/games/guess.ts',
  'lucky.ts': 'src/commands/games/lucky.ts',
  'roulette.ts': 'src/commands/games/roulette.ts',
  'trivia.ts': 'src/commands/games/trivia.ts',
  'truthordare.ts': 'src/commands/games/truthordare.ts',
  'typerace.ts': 'src/commands/games/typerace.ts',
  'wordchain.ts': 'src/commands/games/wordchain.ts'
};

for (const [srcFile, destPath] of Object.entries(fileMapping)) {
  const src = path.join(sourceDir, srcFile);
  const dest = path.join(targetDir, destPath);
  
  if (fs.existsSync(src)) {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
    console.log("Replaced target in discord-bot: " + destPath);
  } else {
    console.warn("Source file not found: " + srcFile);
  }
}
console.log("Migration complete!");
