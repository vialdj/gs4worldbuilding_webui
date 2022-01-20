from .. import gs4worldbuilding as gs4wb

import re
import mimetypes
mimetypes.add_type('text/javascript', '.js')

from flask import Flask, render_template
from astropy import units as u
import numpy as np

app = Flask(__name__)

app.debug = True

biggest_world = None
biggest_star = None

@app.template_test('planet')
def is_planet(obj):
    return issubclass(type(obj), gs4wb.planet.Planet)

@app.template_test('terrestrial')
def is_terrestrial(obj):
    return issubclass(type(obj), gs4wb.terrestrial.Terrestrial)

@app.template_test('satellite')
def is_satellite(obj):
    return issubclass(type(obj._orbit._parent_body), gs4wb.planet.Planet)

@app.template_test('asteroid_belt')
def is_asteroid_belt(obj):
    return issubclass(type(obj), gs4wb.asteroid_belt.AsteroidBelt)

@app.template_filter()
def to_radian(value):
    return value.to(u.rad).value

@app.template_filter()
def to_earth_radius(value):
    return value.to(u.R_earth).value

@app.template_filter()
def radiusFormat(value):
    s = '{:.2f} km'.format(value.to(u.km).value)
    if value.to(u.R_jup).value > 5:
        return '{} ({:.2f} R☉)'.format(s, value.to(u.R_sun).value)
    elif value.to(u.R_earth).value > 5:
        return '{} ({:.2f} R♃)'.format(s, value.to(u.R_jup).value)
    return '{} ({:.2f} R🜨)'.format(s, value.to(u.R_earth).value)

@app.template_filter()
def diameterFormat(value):
    s = '{:.2f} km'.format(value.to(u.km).value)
    if value.to(gs4wb.units.D_jup).value > 5:
        return '{} ({:.2f} D☉)'.format(s, value.to(gs4wb.units.D_sun).value)
    elif value.to(gs4wb.units.D_earth).value > 5:
        return '{} ({:.2f} D♃)'.format(s, value.to(gs4wb.units.D_jup).value)
    return '{} ({:.2f} D🜨)'.format(s, value.to(gs4wb.units.D_earth).value)

@app.template_filter()
def scaleRadius(value):
    scale = (biggest_world.diameter / 2 if
             biggest_world.diameter > biggest_star.radius * 2 else
             biggest_star.radius)
    scale = np.sqrt(scale.to(gs4wb.units.D_earth).value)
    return int(round(np.sqrt(value.to(gs4wb.units.D_earth).value) / scale * 50))

@app.template_filter()
def scaleDiameter(value):
    scale = (biggest_world.diameter / 2 if
             biggest_world.diameter > biggest_star.radius * 2 else
             biggest_star.radius)
    scale = np.sqrt(scale.to(gs4wb.units.D_earth).value)
    return int(round(np.sqrt(value.to(gs4wb.units.D_earth).value / 2) / scale * 50))

@app.template_filter()
def timeFormat(value):
    if value.value == np.inf:
        return '∞'
    elif value.to(u.Ma).value > 10 ** 3:
        return '{:.2f} Ga'.format(value.to(u.Ga).value)
    elif value.to(u.a).value > 10 ** 5:
        return '{:.2f} Ma'.format(value.to(u.Ma).value)
    elif value.to(u.a).value > 10:
        return '{:.2f} years'.format(value.to(u.a).value)
    elif value.to(u.d).value > 10:
        return '{:.2f} days ({:.2f} years)'.format(value.to(u.d).value,
                                                   value.to(u.a).value)
    s = value.to(u.s).value
    h = s // 3600
    s -= 3600 * h
    m = s // 60
    s -= 60 * m
    return '{:.0f}<sup>h</sup>{:02.0f}<sup>m</sup>{:02.0f}<sup>s</sup>.{} ({:.2f} days)'.format(h, m, s // 1, str(s % 1)[2:][:2], value.to(u.d).value)

@app.template_filter()
def distanceFormat(value):
    if value.to(u.au).value > .1:
        return '{:.2g} AU'.format(value.value)
    else:
        return '{:.2f} km ({:.2g} AU)'.format(value.to(u.km).value, value.to(u.au).value)

@app.template_filter()
def massFormat(value):
    if value.to(u.M_jup).value > 10 ** 2:
        return '{:.2g} M☉'.format(value.to(u.M_sun).value)
    elif value.to(u.M_earth).value > 10 ** 2:
        return '{:.2g} M♃'.format(value.to(u.M_jup).value)
    return '{:.2g} M🜨'.format(value.to(u.M_earth).value)

@app.template_filter()
def atmoCompositionFormat(value):
    return ', '.join(''.join('<sub>{}</sub>'.format(c) if c.isdigit() else c for c in s) for s in value)

@app.template_filter()
def atmoPressureFormat(value):
    return '{:.2f} atm'.format(value.value)

@app.template_filter()
def typeFormat(value):
    return ' '.join(re.findall('[A-Z][^A-Z]*', value.__class__.__name__))

@app.template_filter()
def atmoPropertiesFormat(value):
    properties = []
    properties.append('Breathable' if value.breathable else 'Non-breathable')
    if issubclass(type(value), gs4wb.terrestrial.Marginal):
        properties.append(' '.join(re.findall('[A-Z][^A-Z]*', value.__class__.__name__)))
    if value.suffocating:
        properties.append('Suffocating')
    if value.toxicity:
        d = {gs4wb.terrestrial.Atmosphere.Toxicity.NONE: 'Negligible',
             gs4wb.terrestrial.Atmosphere.Toxicity.MILD: 'Mild',
             gs4wb.terrestrial.Atmosphere.Toxicity.HIGH: 'High',
             gs4wb.terrestrial.Atmosphere.Toxicity.LETHAL: 'Lethal'}
        if type(value.toxicity) == gs4wb.model.bounds.ValueBounds:
            properties.append('{} to {} Toxicity'.format(d[value.toxicity.min], d[value.toxicity.max]))
        else:
            properties.append('{} Toxicity'.format(d[value.toxicity]))
    if value.corrosive:
        properties.append('Corrosive')
    return ', '.join(properties)

@app.template_filter()
def celsiusFormat(value):
    return '{:.2f} °C ({:.2f} K)'.format(value.to(u.deg_C, equivalencies=u.temperature()).value, value.value)

@app.template_filter()
def enumFormat(value):
    return value.name.replace('_', ' ').title()

@app.template_filter()
def scoreFormat(value):
    return '{:+}'.format(value)

@app.template_filter()
def resourceFormat(value):
    return '{:+} ({})'.format(value.value, value.name.replace('_', ' ').title())

@app.template_filter()
def dmsFormat(value):
    m, s = divmod(value.value * 3600, 60)
    d, m = divmod(m, 60)
    return '{:.0f}°{:02.0f}"{:02.0f}\'.{}'.format(d, m, s, str(s % 1)[2:][:2])


@app.route('/random_world')
def random_world():
    world = gs4wb.Builder.build_world()
    return render_template('terrestrial.html', world=world)

@app.route('/')
def random_star_system():
    star_system = gs4wb.Builder.build_star_system()
    global biggest_world, biggest_star
    biggest_world = sorted(star_system._worlds, key=lambda x: x.diameter if hasattr(x, 'diameter') else 0)[-1]
    biggest_star = sorted(star_system._stars, key=lambda x: x.radius if hasattr(x, 'radius') else 0)[-1]
    return render_template('star_system.html', star_system=star_system)


if __name__ == '__main__':
    app.run()
