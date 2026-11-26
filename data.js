/* Fake catalog. Everything here is synthetic. */
(function () {
  var D = [
    ['lisbon', 'Lisbon', 'Portugal', 'Europe', 780, 'Tiled hills, tram 28 and custard tarts.'],
    ['kyoto', 'Kyoto', 'Japan', 'Asia', 1450, 'Temples, tea houses and lantern-lit alleys.'],
    ['paris', 'Paris', 'France', 'Europe', 980, 'Museums, bakeries and long riverside walks.'],
    ['bali', 'Ubud, Bali', 'Indonesia', 'Asia', 1120, 'Rice terraces, waterfalls and slow mornings.'],
    ['reykjavik', 'Reykjavik', 'Iceland', 'Europe', 1180, 'Geothermal pools and northern lights.'],
    ['marrakech', 'Marrakech', 'Morocco', 'Africa', 690, 'Souks, riads and rooftop sunsets.'],
    ['mexico-city', 'Mexico City', 'Mexico', 'North America', 640, 'Street tacos, murals and markets.'],
    ['cape-town', 'Cape Town', 'South Africa', 'Africa', 1320, 'Table Mountain, vineyards and coastal drives.'],
    ['banff', 'Banff', 'Canada', 'North America', 890, 'Turquoise lakes and alpine trails.'],
    ['santorini', 'Santorini', 'Greece', 'Europe', 1050, 'Whitewashed villages above a blue caldera.'],
    ['tokyo', 'Tokyo', 'Japan', 'Asia', 1380, 'Neon nights, ramen counters and quiet shrines.'],
    ['rome', 'Rome', 'Italy', 'Europe', 840, 'Ancient ruins and the best pasta of your life.'],
    ['cusco', 'Cusco', 'Peru', 'South America', 960, 'Gateway to Machu Picchu and the Sacred Valley.'],
    ['sydney', 'Sydney', 'Australia', 'Oceania', 1580, 'Harbour ferries, surf beaches and coastal walks.'],
    ['dubai', 'Dubai', 'UAE', 'Asia', 1210, 'Skyline views, desert dunes and souk shopping.'],
    ['new-york', 'New York', 'USA', 'North America', 720, 'Broadway, bagels and endless neighborhoods.']
  ];
  var TAGS = ['Culture', 'Food', 'Nature', 'Beach', 'Adventure', 'City', 'Romantic', 'Family'];
  var trips = [];
  var seed = 7;
  function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
  D.forEach(function (d, i) {
    var kinds = [
      ['Explorer', 5, 1.0, 3],
      ['Comfort', 7, 1.35, 4],
      ['Luxe', 7, 2.1, 5]
    ];
    kinds.forEach(function (k, j) {
      var t = {
        id: d[0] + '-' + k[0].toLowerCase(),
        slug: d[0],
        city: d[1],
        country: d[2],
        region: d[3],
        title: k[0] + ' ' + d[1],
        blurb: d[5],
        nights: k[1],
        stars: k[3],
        price: Math.round(d[4] * k[2] / 10) * 10,
        rating: Math.round((4.1 + rnd() * 0.85) * 10) / 10,
        reviews: 40 + Math.floor(rnd() * 900),
        tags: [TAGS[(i + j) % 8], TAGS[(i * 3 + j + 2) % 8]],
        hue: (i * 41 + j * 17) % 360,
        soldOut: (i * 3 + j) % 11 === 0
      };
      trips.push(t);
    });
  });
  window.WF_DATA = {
    trips: trips,
    destinations: D.map(function (d) { return { slug: d[0], city: d[1], country: d[2], region: d[3] }; }),
    extras: [
      { id: 'insurance', name: 'Trip protection', price: 59, note: 'Cancel for any reason up to 48h before.' },
      { id: 'transfer', name: 'Airport transfers', price: 74, note: 'Private car, both directions.' },
      { id: 'upgrade', name: 'Room upgrade', price: 130, note: 'Subject to availability.' },
      { id: 'tour', name: 'Guided day tour', price: 95, note: 'Small group, English-speaking guide.' }
    ],
    promos: { WELCOME10: 0.1 },
    demoUser: { email: 'alex.rivera@example.com', name: 'Alex Rivera' },
    pastBookings: [
      { ref: 'WF-48213', trip: 'paris-comfort', date: '3 weeks ago', total: 1862, status: 'Completed' },
      { ref: 'WF-47190', trip: 'lisbon-explorer', date: '5 weeks ago', total: 802, status: 'Completed' }
    ]
  };
})();
