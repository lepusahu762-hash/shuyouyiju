"""Originals immutable; all coordinates refer to the EXIF-oriented PNG preview."""
from io import BytesIO
from PIL import Image, ImageOps, UnidentifiedImageError
import hashlib
from .parsers import ParseError


def parse_image(path,aid,settings):
    try:
        if path.stat().st_size>settings.image_max_bytes:raise ParseError('图片最多8 MiB，请缩小文件后上传。')
        with Image.open(path) as original:
            if original.format not in {'PNG','JPEG'} or getattr(original,'n_frames',1)!=1:raise ParseError('仅支持静态PNG或JPEG，文件内容必须与格式匹配。')
            if original.width*original.height>settings.image_max_pixels or max(original.size)>8000:raise ParseError('图片超过1200万像素或单边8000像素，请先裁剪。')
            expected='PNG' if path.suffix.lower()=='.png' else 'JPEG'
            if original.format!=expected:raise ParseError('图片扩展名与实际格式不匹配。')
            oriented=ImageOps.exif_transpose(original)
            if 'A' in oriented.getbands() or 'transparency' in oriented.info:
                rgba=oriented.convert('RGBA');image=Image.new('RGB',rgba.size,'white');image.paste(rgba,mask=rgba.getchannel('A'))
            else:image=oriented.convert('RGB')
            image.info.clear()  # do not forward EXIF/GPS metadata; original bytes are retained
            size=image.size
            output=BytesIO();image.save(output,format='PNG');data=output.getvalue()
        if len(data)>24*1024*1024:raise ParseError('校正方向后的预览超过24 MiB，请先裁剪。')
        folder=settings.data_dir.resolve()/'image_previews';folder.mkdir(parents=True,exist_ok=True)
        target=folder/(aid+'.png');temporary=folder/(aid+'.tmp');temporary.write_bytes(data);temporary.replace(target)
        return {'kind':'image','width':size[0],'height':size[1],'source_id':f'{aid}:v1:image',
                'orientation':'EXIF转正后的像素坐标','normalized_sha256':hashlib.sha256(data).hexdigest(),
                'notes':['原文件不改写；预览与模型选区统一采用转正后的图像。']}
    except ParseError:raise
    except (UnidentifiedImageError,OSError,ValueError,Image.DecompressionBombError,Image.DecompressionBombWarning) as error:
        raise ParseError('无法读取图片，可能损坏、格式无效或像素过大。原件保留，可单独重试。') from error


def crop_bytes(settings,source):
    path=settings.data_dir.resolve()/'image_previews'/(source['asset_id']+'.png')
    data=path.read_bytes()
    if hashlib.sha256(data).hexdigest()!=source['normalized_sha256']:raise ValueError('图片预览指纹已变化，请恢复原件或新建任务。')
    r=source['region']
    with Image.open(BytesIO(data)) as image:
        w,h=image.size
        box=(round(r['x']*w),round(r['y']*h),round((r['x']+r['width'])*w),round((r['y']+r['height'])*h))
        if box[2]-box[0]<16 or box[3]-box[1]<16:raise ValueError('选区至少16×16像素。')
        cropped=image.crop(box);out=BytesIO();cropped.save(out,format='PNG')
    raw=out.getvalue()
    if len(raw)>settings.image_max_bytes:raise ValueError('当前图片选区编码超过8 MiB，请选择更小区域。')
    return raw,{'width':box[2]-box[0],'height':box[3]-box[1],'box_pixels':list(box)}
