import { Database } from "bun:sqlite";
import path from "path";
import fs from "fs";

const DB_PATH =
  process.env.FOODPOD_DB_PATH ??
  path.join(process.cwd(), "data", "foodpod.db");

// Ensure directory exists
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

export const db = new Database(DB_PATH, { create: true });

// Enable WAL for better concurrent read performance
db.run("PRAGMA journal_mode = WAL");

// Create tables if missing
db.run(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT,
    name TEXT,
    profile_json TEXT,
    daily_targets_json TEXT,
    created_at INTEGER
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS pods (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    status TEXT CHECK(status IN ('collecting','generating','ready','error')) DEFAULT 'collecting',
    target_count INTEGER DEFAULT 7,
    captured_count INTEGER DEFAULT 0,
    created_at INTEGER,
    ready_at INTEGER
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS meal_images (
    id TEXT PRIMARY KEY,
    pod_id TEXT,
    sequence_number INTEGER,
    image_path TEXT,
    uploaded_at INTEGER
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS episodes (
    id TEXT PRIMARY KEY,
    pod_id TEXT UNIQUE,
    title TEXT,
    summary_text TEXT,
    script_text TEXT,
    audio_path TEXT,
    duration_sec REAL,
    created_at INTEGER
  )
`);

export type Pod = {
  id: string;
  user_id: string;
  status: "collecting" | "generating" | "ready" | "error";
  target_count: number;
  captured_count: number;
  created_at: number;
  ready_at: number | null;
};

export type MealImage = {
  id: string;
  pod_id: string;
  sequence_number: number;
  image_path: string;
  uploaded_at: number;
};

export type Episode = {
  id: string;
  pod_id: string;
  title: string;
  summary_text: string;
  script_text: string;
  audio_path: string | null;
  duration_sec: number | null;
  created_at: number;
};
