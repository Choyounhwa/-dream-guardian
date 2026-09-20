from PIL import Image
import glob

for p in glob.glob(r"e:\AIAIAIAI\Arithmetic Game\img\*.png"):
    try:
        img = Image.open(p).convert("RGBA")
        data = img.load()
        bg_color = data[0, 0]
        if bg_color[0] > 230 and bg_color[1] > 230 and bg_color[2] > 230:
            for y in range(img.height):
                for x in range(img.width):
                    r,g,b,a = data[x,y]
                    dist = abs(r-bg_color[0]) + abs(g-bg_color[1]) + abs(b-bg_color[2])
                    if dist < 30:
                        data[x,y] = (r,g,b,0)
                    elif dist < 60:
                        alpha = int(255 * (dist - 30)/30.0)
                        data[x,y] = (r,g,b,alpha)
        img.save(p)
        print("Processed " + p)
    except Exception as e:
        print("Error on " + p + ": " + str(e))
