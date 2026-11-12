"""Independent synthetic fixtures; no model request, no production data."""
from pathlib import Path
import csv
from PIL import Image,ImageDraw,ImageFont,ImageFilter

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'artifacts/image-demo'
RULE='纳入记录满意率：按记录/行统计，不去重。纳入标记为“是”的全部记录进入分母，服务评价为“满意”的记录进入分子；服务评价为空的纳入记录仍保留在分母。采用分子÷分母×100%，显示及比较均为0位小数。图中未显示统计期间，本合成案例也不限定期间。'


def make():
    OUT.mkdir(parents=True,exist_ok=True)
    with (OUT/'独立合成_12条.csv').open('w',encoding='utf-8-sig',newline='') as f:
        writer=csv.writer(f);writer.writerow(['记录号','纳入标记','服务评价'])
        writer.writerows([[i,'是','满意' if i<=4 else '不满意' if i<=8 else ''] for i in range(1,11)])
        writer.writerows([[11,'否','满意'],[12,'否','不满意']])
    (OUT/'独立合成_统计规则.txt').write_text(RULE,encoding='utf-8')
    font_path=Path('C:/Windows/Fonts/msyh.ttc')
    if not font_path.exists():raise SystemExit('Please set an available Chinese font in this synthetic generator.')
    font=lambda size:ImageFont.truetype(str(font_path),size)
    for value in [50,40,None]:
        im=Image.new('RGB',(1100,650),'white');d=ImageDraw.Draw(im)
        d.text((55,34),'独立合成测试 · 图表数字待核验',font=font(25),fill='#667085')
        d.text((55,90),'纳入记录满意率',font=font(40),fill='#182033')
        d.line((120,500,970,500),fill='#d3dbea',width=2)
        for x,height,label,color in [(220,270,'满意','#3159eb'),(640,210,'不满意','#9cacda')]:
            d.rounded_rectangle((x,500-height,x+180,500),radius=8,fill=color)
            d.text((x+42,515),label,font=font(28),fill='#182033')
            if value is not None:d.text((x+35,500-height-67),f'{value}%',font=font(42),fill='#182033')
        d.text((55,590),'图中标签用于测试；几何高度不能作为精确百分比依据。',font=font(23),fill='#667085')
        name=f'独立合成_{value if value is not None else "无标签"}.png';im.save(OUT/name)
        if value==50:
            im.save(OUT/'独立合成_50.jpg',quality=95)
            im.filter(ImageFilter.GaussianBlur(18)).save(OUT/'独立合成_模糊.png')
    return OUT


if __name__=='__main__':print(make())
