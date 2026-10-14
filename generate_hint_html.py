import re

with open('/Users/newuser/Github_kimmaru/명탐정 방탈출/src/data/puzzles.ts', 'r', encoding='utf-8') as f:
    ts_code = f.read()

puzzle_blocks = re.findall(r'\{\s*roomNumber:\s*(\d+),\s*title:\s*"([^"]+)",[\s\S]*?question:\s*"([^"]+)",\s*formatGuide:\s*"([^"]+)",\s*answer:\s*"([^"]+)",\s*hints:\s*\[([\s\S]*?)\]\s*\}', ts_code)

puzzles = []
for p in puzzle_blocks:
    room_no = int(p[0])
    title = p[1]
    question = p[2]
    format_guide = p[3]
    answer = p[4]
    raw_hints = p[5]
    hints = [h.strip().strip('"').strip("'") for h in re.findall(r'"([^"]*)"', raw_hints)]
    # Clean emojis for pure text representation
    cleaned_hints = []
    for h in hints:
        clean_h = h.replace("💡 ", "").replace("🔑 ", "").replace("첫 번쨰", "첫 번째")
        cleaned_hints.append(clean_h)
    puzzles.append({
        "roomNumber": room_no,
        "title": title,
        "question": question,
        "formatGuide": format_guide,
        "answer": answer,
        "hints": cleaned_hints
    })

# Pure text, zero color/card decoration, perfectly balanced 1-page A4 layout
html = """<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>명탐정 방탈출 - 힌트 모음</title>
<style>
  @page {
    size: A4 portrait;
    margin: 12mm 13mm 10mm 13mm;
  }
  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Pretendard", "Noto Sans KR", sans-serif;
    color: #000000;
    background: #ffffff;
    font-size: 9pt;
    line-height: 1.42;
  }

  .main-title {
    font-size: 16pt;
    font-weight: 800;
    text-align: center;
    padding-bottom: 7px;
    border-bottom: 1.5px solid #000000;
    margin-bottom: 11px;
    letter-spacing: -0.5px;
  }

  .container {
    display: flex;
    gap: 13mm;
  }

  .column {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .room-block {
    padding-bottom: 8px;
    border-bottom: 0.5px solid #d1d5db;
  }
  .room-block:last-child {
    border-bottom: none;
  }

  .room-title {
    font-size: 11pt;
    font-weight: 700;
    margin-bottom: 4px;
    letter-spacing: -0.3px;
  }

  .hint-list {
    display: flex;
    flex-direction: column;
    gap: 2.5px;
  }

  .hint-item {
    font-size: 8.8pt;
    line-height: 1.38;
    text-align: justify;
    word-break: keep-all;
  }

  .hint-label {
    font-weight: 700;
  }
</style>
</head>
<body>

  <div class="main-title">명탐정 방탈출 — 방별 힌트 모음 (Room 1 ~ 10)</div>

  <div class="container">
    <div class="column">
"""

for p in puzzles[:5]:
    r_no = p["roomNumber"]
    title = p["title"]
    hints = p["hints"]
    
    html += f"""      <div class="room-block">
        <div class="room-title">Room {r_no}. {title}</div>
        <div class="hint-list">
"""
    for idx, h in enumerate(hints, 1):
        html += f"""          <div class="hint-item"><span class="hint-label">Hint {idx}:</span> {h}</div>\n"""
        
    html += """        </div>
      </div>
"""

html += """    </div>
    <div class="column">
"""

for p in puzzles[5:]:
    r_no = p["roomNumber"]
    title = p["title"]
    hints = p["hints"]
    
    html += f"""      <div class="room-block">
        <div class="room-title">Room {r_no}. {title}</div>
        <div class="hint-list">
"""
    for idx, h in enumerate(hints, 1):
        html += f"""          <div class="hint-item"><span class="hint-label">Hint {idx}:</span> {h}</div>\n"""
        
    html += """        </div>
      </div>
"""

html += """    </div>
  </div>

</body>
</html>
"""

output_html = "/Users/newuser/Github_kimmaru/명탐정 방탈출/hints_cheat_sheet.html"
with open(output_html, "w", encoding="utf-8") as f:
    f.write(html)

print("Updated HTML with pure text format.")
