// Connect to notion api with my token
const path = require("path");
const express = require("express");
const cors = require("cors");
const { Client } = require("@notionhq/client");

// paste token here
const NOTION_TOKEN = "add_token_here";
const READINGS_DB_ID = "31fe483094cf807cad59d57f2d8f1de4";

//make website public 
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Called when user hits Pull Cards — creates a row in Notion
app.post("/api/reading", async (req, res) => {
  const { category, spread } = req.body;
  try {
    const notion = new Client({ auth: NOTION_TOKEN });
    const page = await notion.pages.create({
      parent: { database_id: READINGS_DB_ID },
      properties: {
        "Name": { title: [{ text: { content: `${category} — ${spread} — ${new Date().toLocaleDateString()}` } }] },
        "I'm Ready for My Reading": { checkbox: true },
        "Status": { select: { name: "In Progress" } }
      }
    });
    console.log("CREATED PAGE ID:", page.id);
    res.json({ success: true, pageId: page.id });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Called every 5 seconds, checks if THIS SPECIFIC reading is done
app.get("/api/poll", async (req, res) => {
  const { pageId } = req.query;
  console.log("POLLING PAGE ID:", pageId);
  const notion = new Client({ auth: NOTION_TOKEN });
  try {
    const page = await notion.pages.retrieve({ page_id: pageId });
    const props = page.properties;
    const status = props["Status"]?.select?.name || "";

    if (status !== "Completed") return res.json({ ready: false });

    const cardsDrawn = props["Cards Drawn"]?.rich_text?.map(r => r.plain_text).join("") || "";
    const orientation = props["Card Orientation"]?.multi_select?.map(o => o.name).join(", ") || "";
    const interpretation = props["AI Agent Interpretation"]?.rich_text?.map(r => r.plain_text).join("") || "";

    let finalInterpretation = interpretation;
    if (!finalInterpretation) {
      const blocks = await notion.blocks.children.list({ block_id: page.id });
      finalInterpretation = blocks.results
        .map(b => b[b.type]?.rich_text?.map(r => r.plain_text).join("") || "")
        .filter(Boolean)
        .join("\n");
    }

    res.json({ ready: true, cardsDrawn, orientation, interpretation: finalInterpretation });
  } catch (e) {
    console.error("POLL ERROR:", e.message);
    res.status(500).json({ ready: false, error: e.message });
  }
});

// Start the server, make it run on localhost
app.listen(3000, () => console.log("Tarot Shop running at http://localhost:3000"));