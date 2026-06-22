import { homedir } from 'node:os'
import { resolve } from 'path'

export const AGENT_ROOT_DIR = resolve(homedir(), './.hold-rein')

export const SESSION_DIR_NAME = 'sessions'

export const SESSIONS_DIR = resolve(AGENT_ROOT_DIR, `./${SESSION_DIR_NAME}`)

export const MEMORY_DIR = resolve(AGENT_ROOT_DIR, './memories')

export const SKILL_DIR = resolve(AGENT_ROOT_DIR, './skills')

export const DB_FILE = resolve(AGENT_ROOT_DIR, './hold-rein.sqlite')
