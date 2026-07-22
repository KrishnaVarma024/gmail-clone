// data.js — DATA LAYER
//
// Generates the mock dataset this whole app runs on: 5,000 fake emails
// (sender, subject, snippet, timestamp, read/unread). This is the app's
// fake "database" — the only file allowed to invent data. Everything
// downstream (state, virtualList, render) just reads what this produces.
//
// Each email also gets an avatar color: hash the sender's name to a
// number 1-8, map it to the .avatar--N classes already defined in
// styles.css. Deterministic on purpose — the same sender should always
// get the same color, every render, without storing it anywhere.
//
// Built in Phase 2.
