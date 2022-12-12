precision highp float;

uniform float time;
uniform vec2 resolution;
uniform sampler2D spectrum;
uniform sampler2D midi;

uniform sampler2D greyTex;
uniform sampler2D cookieTex;
uniform sampler2D ziconTex;

float mtime; // modulated time

#define FFTI(a) time

#define sat(a) clamp(a, 0., 1.)
#define FFT(a) texture2D(spectrum, vec2(a, 0.)).x

#define EPS vec2(0.01, 0.)
#define AKAI_KNOB(a) (texture2D(midi, vec2(176. / 256., (0.+min(max(float(a), 0.), 7.)) / 128.)).x)

#define MIDI_KNOB(a) (texture2D(midi, vec2(176. / 256., (16.+min(max(float(a), 0.), 7.)) / 128.)).x)
#define MIDI_FADER(a) (texture2D(midi, vec2(176. / 256., (0.+min(max(float(a), 0.), 7.)) / 128.)).x)

#define MIDI_BTN_S(a) sat(texture2D(midi, vec2(176. /  256., (32.+min(max(float(a), 0.), 7.)) / 128.)).x*10.)
#define MIDI_BTN_M(a) sat(texture2D(midi, vec2(176. / 256., (48.+min(max(float(a), 0.), 7.)) / 128.)).x*10.)
#define MIDI_BTN_R(a) sat(texture2D(midi, vec2(176. / 256., (64.+min(max(float(a), 0.), 7.)) / 128.)).x*10.)

#define FFTlow (FFT(0.1) * MIDI_KNOB(0))
#define FFTmid (FFT(0.5) * MIDI_KNOB(1))
#define FFThigh (FFT(0.7) * MIDI_KNOB(2))
#define PI 3.14159265
#define TAU (PI*2.0)
float hash(float seed)
{
    return fract(sin(seed*123.456)*123.456);
}

float _cube(vec3 p, vec3 s)
{
  vec3 l = abs(p)-s;
  return max(l.x, max(l.y, l.z));
}
float _cucube(vec3 p, vec3 s, vec3 th)
{
    vec3 l = abs(p)-s;
    float cube = max(max(l.x, l.y), l.z);
    l = abs(l)-th;
    float x = max(l.y, l.z);
    float y = max(l.x, l.z);
    float z = max(l.x, l.y);

    return max(min(min(x, y), z), cube);
}
float _seed;

float rand()
{
    _seed++;
    return hash(_seed);
}

mat2 r2d(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }

vec3 getCam(vec3 rd, vec2 uv)
{
    vec3 r = normalize(cross(rd, vec3(0.,1.,0.)));
    vec3 u = normalize(cross(rd, r));
    return normalize(rd+(r*uv.x+u*uv.y)*3.);
}

float lenny(vec2 v)
{
    return abs(v.x)+abs(v.y);
}
float _sqr(vec2 p, vec2 s)
{
    vec2 l = abs(p)-s;
    return max(l.x, l.y);
}
float _cir(vec2 uv, float sz)
{
  return length(uv)-sz;
}

float _loz(vec2 uv,float sz)
{
  return lenny(uv)-sz;
}
vec2 _min(vec2 a, vec2 b)
{
    if (a.x < b.x)
        return a;
    return b;
}
vec2 _max(vec2 a, vec2 b)
{
  if (a.x > b.x)
      return a;
  return b;
}

// To replace missing behavior in veda
vec4 textureRepeat(sampler2D sampler, vec2 uv)
{
  return texture2D(sampler, mod(uv, vec2(1.)));
}

vec2 map(vec3 p)
{
    vec2 acc = vec2(10000., -1.);

    vec3 psph = p-vec3(sin(time), cos(time*.5), cos(time*2.3)*4.)*.2+vec3(0.,0.,-3.);
    acc = _min(acc, vec2(length(psph)-.5, 0.));
    vec3 p2 = p+vec3(0.,0.,time);
p2.xy *= r2d(p.z*.2-time*.2);
    float tunnel = _loz(p2.xy, 1.+abs(sin(p2.z)) + 3.*abs(sin(p.z*.3)));
    acc = _min(acc, vec2(tunnel, 1.));

acc = _min(acc, vec2(-_cube(p, vec3(9.)), 2.));
for (int i = 0; i < 4; ++i)
{
  vec3 p3 = p;
  p3.xy *= r2d(float(i));
  p3.xz *= r2d(float(i)+.5*time);
  acc = _min(acc, vec2(_cucube(p3, vec3(5.), vec3(.1)), 2.));

}
    return acc;
}


vec3 accCol;
vec3 trace(vec3 ro, vec3 rd)
{
    accCol = vec3(0.);
    vec3 p = ro;
    for (int i = 0; i < 128; ++i)
    {
        vec2 res = map(p);
        if (res.x < 0.01)
            return vec3(res.x, distance(p, ro), res.y);
        p+= rd*res.x;
    }
    return vec3(-1.);
}

vec3 getNorm(vec3 p, float d)
{
  vec2 e = vec2(0.01, 0.);
  return  normalize(vec3(d) - vec3(map(p-e.xyy).x, map(p-e.yxy).x, map(p-e.yyx).x));
}

vec3 getMat(vec3 p, vec3 n, vec3 rd, vec3 res)
{
  vec3 col = n *.5+.5;

  if (res.z == 1.)
  {
    vec3 pgrid = p;
    pgrid.z += time;
    vec2 grid = sin(pgrid.yz*40.)+.999;
    float grd = min(grid.x, grid.y);
    float fade = (1.-sat(res.y/10.));
    fade *= fade;
    col = vec3(1.)*(1.-sat(grd*100.))*fade;

    vec2 uv = vec2(atan(p.y, p.x)/PI, p.z+time);

    col += pow(textureRepeat(ziconTex, uv).x, 2.)*vec3(.5,.2,.1)*.125;
  }
  return col;
}

vec3 rdr(vec2 uv)
{
  uv *= r2d(time*.2);
    vec3 ro = vec3(sin(time*.3)*.7+5.,sin(time*.2)*9., -5.);
    vec3 ta = vec3(0.,0.,0.);
    vec3 rd = normalize(ta-ro);
    rd = getCam(rd, uv);
    vec3 col = vec3(0.);

    vec3 res = trace(ro, rd);
    float depth = 100.;
    if (res.y > 0.)
    {
      depth = res.y;
        vec3 p = ro + rd*res.y;
        vec3 n = getNorm(p, res.x);
        col = getMat(p, n, rd, res);

        float spec = .1;
        vec3 refl = normalize(reflect(rd, n)+spec*(vec3(rand(), rand(), rand())-.5));
        vec3 resrefl = trace(p+n*0.01, refl);
        if (resrefl.y > 0.)
        {
          vec3 prefl = p+refl*resrefl.y;
          vec3 nrefl = getNorm(prefl, resrefl.x);

          col += getMat(prefl, nrefl, refl, resrefl);
        }
    }
col = mix(col, vec3(.2,.5,.9), 1.-exp(-depth*.1));
float beat = 1./2.3;
col += .25*vec3(.2,.3,.8)*pow(mod(time, beat)/beat, 2.);
col = pow(col, vec3(1.8));

vec2 uv2 = vec2(atan(uv.y, uv.x)/PI, length(uv)*.1-time*.2);
   col += pow(textureRepeat(greyTex, uv2).xxx,vec3(5.))*sat(length(uv))*vec3(sin(uv.xyx*20.));

    return col;
}
uniform sampler2D backbuffer;
void main() {
  vec2 ouv = gl_FragCoord.xy / resolution.xy;
    vec2 uv = (gl_FragCoord.xy-.5*resolution.xy) / resolution.xx;
    _seed = time+textureRepeat(greyTex, uv).x;
   vec3 col = rdr(uv);
       float stp = .1;
       vec2 uv2 = uv;
       //uv2 = mod(uv2+stp*.5,stp)-stp-.5;
   col += rdr(uv+(vec2(rand(), rand())-.5)*.05)*.35;
   col += texture2D(ziconTex, uv*4.+.5).xxx*.4;
   col = sat(col);
   col = mix(col, texture2D(backbuffer, ouv).xyz, .5);

//   col += texture2D(ziconTex, (uv*4.+.5)).xyz;
    gl_FragColor = vec4(col, 1.0);
}
