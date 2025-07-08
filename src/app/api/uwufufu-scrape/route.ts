import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    if (!url || !/^https:\/\/uwufufu\.com\//.test(url)) {
      return NextResponse.json({ error: "Link Uwufufu non valido" }, { status: 400 });
    }

    const htmlResp = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      cache: "no-store",
    });
    if (!htmlResp.ok) {
      return NextResponse.json({ error: "Errore fetching HTML Uwufufu" }, { status: 500 });
    }
    const html = await htmlResp.text();

    const $ = cheerio.load(html);
    const scripts = $('script')
      .toArray()
      .map((el) => $(el).html() || "");

    // In modalità debug: ritorna tutti i primi 1000 caratteri di ogni script
    return NextResponse.json({
      error: "DEBUG",
      scripts: scripts.map(s => s.slice(0, 1000))
    }, { status: 500 });
  } catch (err) {
    return NextResponse.json({ error: "Errore server Uwufufu Scraping" }, { status: 500 });
  }
}
