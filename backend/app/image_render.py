"""Turns a 3D-view screenshot + a room's known facts into a photorealistic
interior render via OpenAI's image-edit API (gpt-image-1) — an image-to-image
transform so the result respects the actual layout/furniture placement
instead of just a text-to-image guess."""

import base64
import os

import httpx

OPENAI_IMAGES_EDIT_URL = "https://api.openai.com/v1/images/edits"
CEILING_HEIGHT_FT = 8  # fixed for this build, not stored per-room


def _format_dims(width_in, height_in):
    def feet_inches(inches):
        ft = int(inches // 12)
        inch = round(inches % 12)
        return f"{ft}'{inch}\"" if inch else f"{ft}'"
    return f"{feet_inches(width_in)} x {feet_inches(height_in)}"


def build_prompt(room, features, extra_instructions=""):
    furniture_lines = [f"- {f.label or f.type.replace('_', ' ')}" for f in features]
    furniture_block = "\n".join(furniture_lines) if furniture_lines else "- (no furniture placed yet)"
    paint_note = f"Walls are painted {room.paint_color}." if room.paint_color else ""

    prompt = (
        f"This reference image is a 3D layout rendering of a room called '{room.name}', "
        f"{_format_dims(room.width, room.height)} with {CEILING_HEIGHT_FT}-foot ceilings. "
        f"{paint_note}\n"
        f"Furniture and fixtures in this room:\n{furniture_block}\n\n"
        "Using the reference image strictly for room proportions, camera framing, wall "
        "positions, and furniture placement, generate a photorealistic interior design "
        "rendering of this exact room. Keep every piece of furniture in the same position "
        "and orientation shown. Replace the flat, low-poly placeholder shapes with "
        "realistic materials, textures, and lighting appropriate to a real home. "
        "Do not add furniture that isn't listed above, and do not change the room's "
        "proportions or the camera angle."
    )
    if extra_instructions:
        prompt += f"\n\nAdditional direction from the user: {extra_instructions}"
    return prompt


async def generate_render(image_bytes: bytes, prompt: str) -> bytes:
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not configured on the server")

    async with httpx.AsyncClient(timeout=120) as client:
        resp = await client.post(
            OPENAI_IMAGES_EDIT_URL,
            headers={"Authorization": f"Bearer {api_key}"},
            data={"model": "gpt-image-1", "prompt": prompt, "size": "1536x1024"},
            files={"image": ("scene.png", image_bytes, "image/png")},
        )
    if resp.status_code != 200:
        raise RuntimeError(f"OpenAI image generation failed ({resp.status_code}): {resp.text[:500]}")

    data = resp.json()["data"][0]
    if "b64_json" in data:
        return base64.b64decode(data["b64_json"])
    # Fallback: some responses return a URL instead of inline base64.
    async with httpx.AsyncClient(timeout=60) as client:
        img_resp = await client.get(data["url"])
        img_resp.raise_for_status()
        return img_resp.content
