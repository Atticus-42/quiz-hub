"""Build the printable Reviewer 101 editions from the site content (requires ReportLab)."""
import json
import os
from pathlib import Path
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import PageBreak, Paragraph, SimpleDocTemplate

ROOT = Path(__file__).resolve().parents[1]
FONTS = ROOT / 'assets' / 'vendor' / 'pdfjs' / 'standard_fonts'
INK, OLIVE = colors.HexColor('#222619'), colors.HexColor('#4b5127')
pdfmetrics.registerFont(TTFont('Reviewer', str(FONTS / 'LiberationSans-Regular.ttf')))
pdfmetrics.registerFont(TTFont('ReviewerBold', str(FONTS / 'LiberationSans-Bold.ttf')))
pdfmetrics.registerFontFamily('Reviewer', normal='Reviewer', bold='ReviewerBold')
BODY = ParagraphStyle('body', fontName='Reviewer', fontSize=10.5, leading=14.5, textColor=INK, spaceAfter=7)
TITLE = ParagraphStyle('title', parent=BODY, fontName='ReviewerBold', fontSize=24, leading=27, spaceAfter=13)
HEADING = ParagraphStyle('heading', parent=BODY, fontName='ReviewerBold', fontSize=14, leading=17,
                         textColor=OLIVE, spaceBefore=9, keepWithNext=True)
LABEL = ParagraphStyle('label', parent=BODY, fontName='ReviewerBold', fontSize=9, textColor=OLIVE)
LIBRARY = json.loads((ROOT / 'data' / 'library.json').read_text(encoding='utf-8'))


def paragraph(value, style=BODY):
    return Paragraph(escape(value), style)


def labeled(label, value):
    return Paragraph(f'<b>{escape(label)}</b> · {escape(value)}', BODY)


def footer(canvas, doc):
    canvas.setStrokeColor(OLIVE)
    canvas.line(17 * mm, 15 * mm, 193 * mm, 15 * mm)
    canvas.setFont('Reviewer', 8)
    canvas.setFillColor(INK)
    canvas.drawString(17 * mm, 10 * mm, 'SOAC 52-26  /  BANDWIDTH BROTHERS  /  STUDY EDITION')
    canvas.drawRightString(193 * mm, 10 * mm, str(doc.page))


def build(key, reviewer):
    lesson = json.loads((ROOT / 'lessons' / key / 'lesson.json').read_text(encoding='utf-8'))
    name = lesson['name']
    label = f"REVIEWER 101  /  {lesson['module'].replace('-', ' ').upper()}"
    story = [
        paragraph(label, LABEL), paragraph(name, TITLE),
        paragraph('Quick briefing', HEADING), paragraph(reviewer['brief']),
        paragraph('Know the facts', HEADING),
        *[labeled(fact['term'], fact['detail']) for fact in reviewer['facts']],
        paragraph('Understand the reasoning', HEADING),
        *[paragraph(insight) for insight in reviewer['insights']],
        PageBreak(),
        paragraph('APPLY AND CHECK  /  ' + name.upper(), LABEL),
        paragraph('Philippine Army classroom exercise', HEADING),
        paragraph(reviewer['scenario']['situation']),
        labeled('Decision', reviewer['scenario']['question']),
        labeled('Worked analysis', reviewer['scenario']['analysis']),
    ]
    if reviewer['steps']:
        story.append(paragraph('How to practice', HEADING))
        story.extend(labeled(str(index), step) for index, step in enumerate(reviewer['steps'], 1))
    story.append(paragraph('Check yourself', HEADING))
    story.extend(labeled(check['question'], check['answer']) for check in reviewer['checks'])
    story.extend([paragraph('Course source', HEADING), paragraph(LIBRARY['lessonSources'][key][0])])
    target = ROOT / 'library' / 'files' / f"reviewer-{lesson['slug']}.pdf"
    doc = SimpleDocTemplate(str(target), pagesize=A4, title=name + ' | Reviewer 101', author='SOAC 52-26',
                            leftMargin=17 * mm, rightMargin=17 * mm, topMargin=16 * mm, bottomMargin=20 * mm)
    doc.build(story, onFirstPage=footer, onLaterPages=footer)


if __name__ == '__main__':
    os.environ.setdefault('SOURCE_DATE_EPOCH', '0')
    for file in sorted((ROOT / 'data' / 'reviewers').glob('*.json')):
        for key, reviewer in json.loads(file.read_text(encoding='utf-8')).items():
            build(key, reviewer)
