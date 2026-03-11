#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const https = require("https");

const envPath = path.join(__dirname, "..", ".env");
fs.readFileSync(envPath, "utf8").split("\n").forEach(line => {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim();
});

const WP_URL = process.env.WP_URL;
const auth = Buffer.from(process.env.WP_USER + ":" + process.env.WP_APP_PASSWORD).toString("base64");

function wpAPI(method, endpoint, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(WP_URL + "/wp-json/wp/v2/" + endpoint);
    const payload = body ? JSON.stringify(body) : "";
    const opts = {
      hostname: url.hostname, path: url.pathname + url.search, method,
      headers: { "Authorization": "Basic " + auth, "Content-Type": "application/json" }
    };
    if (payload) opts.headers["Content-Length"] = Buffer.byteLength(payload);
    const req = https.request(opts, res => {
      let data = "";
      res.on("data", c => data += c);
      res.on("end", () => {
        data = data.replace(/[\x00-\x1f]/g, "");
        try { resolve(JSON.parse(data)); } catch(e) {
          const idMatch = data.match(/"id":(\d+)/);
          resolve(idMatch ? { id: parseInt(idMatch[1]) } : { raw: data.substring(0, 200) });
        }
      });
    });
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function main() {
  console.log("Creating Featured tag...");
  let tag = await wpAPI("POST", "tags", { name: "Featured" });
  let tagId = tag.id;
  if (!tagId) {
    const tags = await wpAPI("GET", "tags?search=Featured&per_page=5");
    const found = Array.isArray(tags) ? tags.find(t => t.name === "Featured") : null;
    if (found) tagId = found.id;
    else { console.log("Could not find/create Featured tag:", JSON.stringify(tag)); return; }
  }
  console.log("Featured tag ID:", tagId);

  const postIds = [16, 17, 18, 19, 20, 21];
  for (const pid of postIds) {
    const post = await wpAPI("GET", "posts/" + pid);
    const currentTags = post.tags || [];
    if (!currentTags.includes(tagId)) {
      await wpAPI("POST", "posts/" + pid, { tags: [...currentTags, tagId] });
      console.log("Post " + pid + ": added Featured tag");
    } else {
      console.log("Post " + pid + ": already has Featured");
    }
  }
  console.log("Done!");
}

main().catch(e => console.error(e));
