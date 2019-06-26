window.addEventListener('load', () => {
  const users = [];
  const events = [];
  const requests = [];

  function getTimeZone(city) {
    const timeZones = moment.tz.names().filter(tz => tz.toUpperCase().includes(city.toUpperCase().replace(/ /g, '_')));
    if (timeZones.length === 0) {
      throw new Error('No time zone was found.');
    }

    let timeZone;
    if (timeZones.length === 1) {
      timeZone = timeZones[0];
    } else {
      let population = 0;
      for (let timeZoneName of timeZones) {
        const zone = moment.tz.zone(timeZoneName);
        if (zone.population >= population) {
          timeZone = zone.name;
          population = zone.population;
        }
      }
    }

    return timeZone;
  }

  function convertToStorage(/** @type {Date} */ instant, /** @type {String} */ timeZone) {
    // Parse the instant as provided by the browser (stored as UTC internally and when printed uses the browser time zone offset)
    const browserInstant = moment(instant);
    //console.log('browser instant', debugInstant(browserInstant));

    // Convert the browser instant to the time zone in the user's profile keeping local time (so just replacing the offset)
    const profileInstant = browserInstant.clone().tz(timeZone, true /* Keep local time */);
    //console.log('profile instant', debugInstant(profileInstant));

    // Convert the profile instant to UTC for storage - this is lossy as the time zone name is lost so DST will not work
    const storageInstant = profileInstant.clone().utc();
    //console.log('storage instant', debugInstant(storageInstant));

    return storageInstant.toDate();
  }

  function convertToDisplay(/** @type {Date} */ instant, /** @type {String} */ timeZone) {
    // Retrieve the stored UTC instant of the event
    const storageInstant = moment.utc(instant);
    //console.log('storage instant', debugInstant(storageInstant));

    // Convert the UTC instant to my time zone irrespective of what the browser time zone is
    const profileInstant = storageInstant.clone().tz(timeZone);
    //console.log('profile instant', debugInstant(profileInstant));

    // Convert the time in my time zone to the browser time zone for display
    const browserTimeZone = moment.tz.guess();
    const browserInstant = profileInstant.clone().tz(browserTimeZone, true /* Keep local time */);
    //console.log('browser instant', debugInstant(browserInstant));

    return debugInstant(browserInstant);
  }

  function registerUser(firstName, lastName, city, defaultResponse) {
    const user = { id: users.length, firstName, lastName, city, timeZone: getTimeZone(city), defaultResponse };
    users.push(user);
    return user;
  }

  function createEvent(user, title, /** @type {Date} */ instant) {
    const event = { id: events.length, userId: user.id, title, instant: convertToStorage(instant, user.timeZone) };
    events.push(event);
    return event;
  }

  function makeRequest(user, event, comment) {
    const owner = users.find(u => u.id === event.userId);
    const request = { id: requests.length, userId: user.id, eventId: event.id, requestorComment: comment, status: 'pending', requesteeComment: owner.defaultResponse };
    requests.push(request);
    return request;
  }

  function reviewRequests(user) {
    let reportMine = '\tMy requests that are waiting to be approved by someone else:\n';
    let reportTheirs = '\tRequests by other people that are waiting for me to accept/reject them:\n';

    for (let request of requests) {
      const event = events.find(e => e.id === request.eventId);
      const instant = convertToDisplay(event.instant, user.timeZone);
      const owner = users.find(u => u.id === event.userId);
      if (request.userId === user.id) {
        reportMine += `\t\t"${event.title}" by ${owner.firstName} ${owner.lastName} at ${instant} is ${request.status}: ${request.requesteeComment}\n`;
      } else if (owner.id === user.id) {
        const attendee = users.find(u => u.id === request.userId);
        reportTheirs += `\t\t[${request.status}] ${attendee.firstName} ${attendee.lastName} for "${event.title}" at ${instant} says "${request.requestorComment}"\n`;
      }
    }

    return `Calendar of ${user.firstName} ${user.lastName}:\n` + reportMine + reportTheirs;
  }

  function administerRequests(user) {
    if (!user.isAdmin) {
      throw new Error('Must be an admin to administer requests.');
    }

    const report = [];
    for (let request of requests) {
      const requestor = users.find(u => u.id === request.userId);
      const requestorName = requestor.firstName + ' ' + requestor.lastName;

      const event = events.find(e => e.id === request.eventId);

      const requestorTimeZoneInstant = convertToDisplay(event.instant, requestor.timeZone);

      const requestee = users.find(u => u.id === event.userId);
      const requesteeName = requestee.firstName + ' ' + requestee.lastName;

      const requesteeTimeZoneInstant = convertToDisplay(event.instant, requestee.timeZone);

      const instant = debugInstant(moment(event.instant));
      const status = request.status;

      report.push({
        requestorName,
        requestorTimeZoneInstant,
        requesteeName,
        requesteeTimeZoneInstant,
        instant,
        status
      });
    }

    console.table(report);
  }

  function approveRequest(user, request, comment) {
    const event = events.find(e => e.id === request.eventId);
    const owner = users.find(u => u.id === event.userId);
    if (user.id !== owner.id) {
      throw new Error('Cannot approve request for event you are not the owner of.');
    }

    request.status = 'approved';
    request.requesteeComment = comment;
  }

  function updateUserLocation(user, city) {
    user.timeZone = getTimeZone(city);
  }

  // The requestee user signs up
  const benMiller = registerUser('Ben', 'Miller', 'Honolulu', 'I\'ll get back to you ASAP');

  // The requestee user creates an event
  const benMillerLecture = createEvent(benMiller, 'My New Book', moment().add(1, 'week').set({ hour: 15, minute: 0, second: 0, millisecond: 0 }).toDate());

  // The requestor user signs up
  const janeDorothy = registerUser('Jane', 'Dorothy', 'Buenos Aires', 'Will respond when I can');

  // The requestor user requests an event
  const janeDorothyRequest = makeRequest(janeDorothy, benMillerLecture, 'I\'d like to attend!');

  // The requestor user reviews their requests - sees Buenos Aires and pending
  console.log(reviewRequests(janeDorothy));

  // The requestee user reviews their requests - sees Honolulu
  console.log(reviewRequests(benMiller));

  // The requestee approves the request
  approveRequest(benMiller, janeDorothyRequest, 'Okay!');

  // The requestor user reviews their requests - sees Buenos Aires and approved
  console.log(reviewRequests(janeDorothy));

  console.log('=====');

  // Same thing but the other way around to check the dates still look okay
  const janeDorothyMeetup = createEvent(janeDorothy, 'My Meetup', moment().add(1, 'day').set({ hour: 22, minute: 0, second: 0, millisecond: 0 }).toDate());
  const benMillerRequest = makeRequest(benMiller, janeDorothyMeetup, 'Can I go?');
  console.log(reviewRequests(benMiller));
  console.log(reviewRequests(janeDorothy));
  approveRequest(janeDorothy, benMillerRequest, 'Sure!');
  console.log(reviewRequests(benMiller));
  console.log(reviewRequests(janeDorothy));

  console.log('=====');

  // The requestee user reviews resets their location to Buenos Aires
  updateUserLocation(benMiller, 'Buenos Aires');

  // The requestee user reviews their requests - sees Buenos Aires
  console.log(reviewRequests(benMiller));

  console.log('=====');

  // The admin user signs up
  const tomasHubelbauer = registerUser('Tomas', 'Hubelbauer', 'Prague');
  tomasHubelbauer.isAdmin = true;

  // The admin users sees all requests with time zones
  updateUserLocation(benMiller, 'Honolulu');
  administerRequests(tomasHubelbauer);
});

/** Prints the date and time values individually to avoid native print functions to carry out any conversion */
function debugInstant(/** @type {Moment} */ instant) {
  return `${instant.year()}-${instant.month() + 1}-${instant.date()}:${instant.hour()}-${instant.minute()}-${instant.second()}@${instant.utcOffset()}`;
}
