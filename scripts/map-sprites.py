"""Rebuild the verified map of the supplied rip using original Amiga bitmap records.

Requires Pillow and the decrunched SPS 0132 disk's Code file (not redistributed here).
Usage: python scripts/map-sprites.py /path/to/0132/1/Code
"""
from pathlib import Path
import hashlib
import json
import sys
from PIL import Image

root = Path(__file__).resolve().parents[1]
code = Path(sys.argv[1]).read_bytes()
assert hashlib.sha256(code).hexdigest() == '3ad4ab5bb5178f238603255c80cc307cd78169c17a201e16065c0909d67f8c94', 'Use the documented SPS 0132 Code binary.'
sheet = Image.open(root / 'public/assets/sprites/lemmings-amiga.png').convert('RGB')
assert hashlib.sha256((root / 'public/assets/sprites/lemmings-amiga.png').read_bytes()).hexdigest() == 'add494f9a9b93eef9d106b1290cd6beb1e69241007dc1cc960784a312fb4d885', 'The supplied rip changed.'

# name, atlas key, direction, Code offset, count, height, planes, foot-relative y,
# source x origin, source y origin. Amiga records include a separate 1-bit mask.
records = [
 ('walk-r','lopen','right',0xcb46,8,10,2,-10,14,0),
 ('walk-l','lopen','left',0xcd62,8,10,2,-10,14,10),
 ('fall-r','vallen','right',0xcf7e,4,10,2,-10,11,20),
 ('fall-l','vallen','left',0xd06e,4,10,2,-10,10,30),
 ('climb-r','klimmen','right',0xd85e,8,12,2,-12,16,40),
 ('climb-l','klimmen','left',0xda9e,8,12,2,-12,16,52),
 ('hoist-r','optrekken','right',0xdcde,8,12,2,-12,16,69),
 ('hoist-l','optrekken','left',0xdf1e,8,12,2,-12,16,85),
 ('float-r','parachute','right',0x10bde,8,16,3,-16,16,96),
 ('float-l','parachute','left',0x10fde,8,16,3,-16,16,112),
 ('ohno','ohno','both',0x138f6,16,10,2,-10,16,128),
 ('splat','pletter','both',0xf05e,16,10,2,-10,16,138),
 ('block','blokkeren','both',0xf41e,16,10,2,-10,16,148),
 ('drown','verdrinken','both',0x1275e,16,10,2,-10,16,158),
 ('fire','branden','both',0x12d8e,14,14,4,-10,16,168),
 ('exit','uitgang','both',0x12b1e,8,13,2,-13,16,182),
 ('build-r','bouwen','right',0xe35e,16,13,3,-13,16,195),
 ('build-l','bouwen','left',0xe9de,16,13,3,-13,16,208),
 ('shrug-r','schouders','right',0x13536,8,10,2,-10,16,224),
 ('shrug-l','schouders','left',0x13716,8,10,2,-10,16,237),
 ('dig','graven','both',0xd15e,16,14,3,-12,16,247),
 ('bash-r','bashen','right',0xf7de,32,10,3,-10,16,261),
 ('bash-l','bashen','left',0x101de,32,10,3,-10,16,281),
 ('mine-r','mijnen','right',0x113de,24,13,3,-12,16,301),
 ('mine-l','mijnen','left',0x11d9e,24,13,3,-12,16,327),
 ('jump-right',None,'right',0xcd26,1,10,2,-10,0,0),
 ('jump-left',None,'left',0xcf42,1,10,2,-10,0,0),
 ('explosion',None,'both',0xe15e,1,32,3,-10,0,0),
]
palette = [(0,0,0),(95,99,255),(0,179,0),(255,235,223),(255,255,0),(255,0,0),(255,0,0),(99,0,19)] + [(255,235,223)]*8
atlas, references, replacements = {}, [], []
fixes = Image.new('RGBA', (64,14))

for name,key,direction,start,count,height,bpp,anchor,x0,y0 in records:
    width = 32 if name == 'explosion' else 16
    plane_size = width*height//8
    size = plane_size*bpp
    frames, golden = [], []
    for f in range(count):
        offset = start+f*(size+plane_size)
        data = code[offset:offset+size]
        mask = code[offset+size:offset+size+plane_size]
        pixels = [sum(((data[p//8+i*plane_size] >> (7-p%8)) & 1) << i for i in range(bpp)) for p in range(width*height)]
        bits = [int(v != 0) for v in pixels]
        mask_bits = [(mask[p//8] >> (7-p%8)) & 1 for p in range(width*height)]
        assert bits == mask_bits or bits == [1-v for v in mask_bits], (name,f,'Amiga mask mismatch')
        golden.append(''.join(map(str,bits)))
        if key is None:
            continue
        column = [0,7,6,5,4,3,2,1][f] if name == 'walk-l' else f
        x, y = x0+column*16, y0
        if name.startswith('hoist'): y -= min(f,4)*2
        if name.startswith('bash'): x=x0+(f%16)*16; y=y0+(f//16)*10
        if name.startswith('mine'): x=x0+(f%12)*16; y=y0+(f//12)*13
        rows = [p//width for p,v in enumerate(bits) if v]
        top,bottom = min(rows),max(rows)
        crop = sheet.crop((x,y+top,x+width,y+bottom+1))
        found = [int(c != (0,0,0)) for c in crop.getdata()]
        expected = bits[top*width:(bottom+1)*width]
        frame = dict(x=x,y=y+top,w=width,h=bottom-top+1,offsetX=-8,offsetY=anchor+top)
        if found != expected:
            # Recover the four damaged rip frames from the actual Amiga data.
            slot = len(replacements)*16
            rgba = [(*palette[v],255 if v else 0) for v in pixels]
            image = Image.new('RGBA',(width,height)); image.putdata(rgba)
            fixes.paste(image,(slot,0))
            frame.update(x=slot,y=top,source='correction')
            replacements.append(dict(name=name,frame=f,codeOffset=offset))
        frames.append(frame)
    if key:
        atlas.setdefault(key,{})
        for d in (['right','left'] if direction=='both' else [direction]): atlas[key][d]=frames
    references.append(dict(name=name,atlas=key,direction=direction,codeOffset=start,width=width,height=height,offsetX=-8,offsetY=anchor,frames=golden))

assert [(r['name'],r['frame']) for r in replacements] == [('drown',0),('drown',1),('drown',2),('fire',7)], replacements
fixes.save(root/'public/assets/sprites/sprite-corrections.png')
lines = ['// Pixel-verified against Amiga SPS 0132 Code. Generated by scripts/map-sprites.py.', 'export const ATLAS = {']
lines += [f'  {key}: {json.dumps(value,separators=(",",":"))},' for key,value in atlas.items()]
lines += ['};','']
(root/'sprite-atlas.js').write_text('\n'.join(lines))
(root/'qa-fixtures').mkdir(exist_ok=True)
(root/'qa-fixtures/sprite-reference.json').write_text(json.dumps(dict(source='Amiga SPS 0132 Code',codeSha256=hashlib.sha256(code).hexdigest(),animations=references,replacements=replacements),separators=(',',':'))+'\n')
print(json.dumps(dict(animations=len(references),nativeFrames=sum(len(r['frames']) for r in references),mappedFrames=sum(r[4] for r in records if r[1]),restoredFrames=replacements)))
