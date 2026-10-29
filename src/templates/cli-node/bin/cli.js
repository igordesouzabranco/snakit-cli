#!/usr/bin/env node
import { Command } from 'commander';

const program = new Command();
program.name('{{nome}}').version('1.0.0');
program.addCommand(new Command('hello').action(() => console.log('Hello from {{nome}}')));
program.parse();
