import { ImageResponse } from "next/og";
import { readFile } from "fs/promises";
import { join } from "path";

export async function GET() {
  const svg = await readFile(join(process.cwd(), "public", "gozly-app-icon.svg"), "utf8");
  const dataUri = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={dataUri} width={512} height={512} alt="" />
      </div>
    ),
    { width: 512, height: 512 }
  );
}
