# JavaScript Time Zone Research

[**DEMO**](https://tomashubelbauer.github.io/js-time-zone-research)

When building web applications which are expected to serve users from all around the world and provide them with the most convenience
when dealing with time, it is important to design the date and time input (collection) and output (display) thoroughly.

Below I document my attempt at doing that for a project I am working on and for my future reference.

The most obvious solution for this is to just take local time instant, convert it to UTC and store that. The problem with this approach
is that by not saving the time zone, daylight saving time (DST) information cannot be recovered. On top of that, the browser JS API's
are insufficient to obtain the time zone of the user's local time. They can give you the time zone _offset_, but that is a value that
may be shared among multiple time zones and they may differ in their DST policy among one another. This means that storing such instant
as UTC is a lossy operation. It would be better to store the time with its time zone, in UTC or local, that doesn't matter.

I've done a bit of research on how Google and Microsoft calendars handle this and in case of both Google calendar and Outlook the web
app uses the user's profile time zone, presumably because they are not able to obtain the time zone IANA ID from the host system as
they are JavaScript applications running in the browser. The Outlook desktop application does have full access to this information as
the OS provides an API to query the current date and time and time zone of the system clock, and this information includes the IANA TZ
ID so time conversions can be lossless.

This leads me to believe the best option to store instants in a web application is to store them in UTC (so that they are normalized
in the database) and store the time zone ID alongside them to not lose DST information. Anything less, I think, is lossy and can and
probably will results in complications down the line.

Below I present an example scenario and four different branches of it evolving as users take actions in the system which differ in how
instants are handled in the application. These below scenarios ignore the fact that the browser is unable to obtain the full TZ info
and so may suggest that pure UTC based on browser time is the best and sufficient solution, but they were not updated since I realized
that so are out of date in this respect and need to be revisited to capture this.

## The Shared Setup

A user called Tom signs up and enters their Prague location while doing so.
Their time zone is inferred to be Prague (+2) from the location entered.
Their browser time zone also says Prague (+2) so the time zones agree.

Tom creates an activity and sets its availability to 4 PM every Wednesday.
4 PM in Prague (+2) time is 2 PM in UTC and that's what we store in the database.

An educator called Barney signs up and enters their London location while doing so.
Their time zone is inferred to be London (+1) from the location entered.
Their browser time zone also says London (+1) so the time zones agree.

Barney comes across Tom's activity and decides to request a slot of its availability.
The availability as persisted is for 2 PM UTC which is 3 PM London (+1) time.

Now Barney knows to show up at 3 PM of London (+1) time and Tom 4 PM Prague (+2) time
and everything is awesome because they actually are in those locations.

~A few weeks later~

Tom moves to Albuquerque.
Tom's time zone is still stored as Prague (+1) in their profile.
Tom's browser shows the time zone of Albuquerque (+6) so the time zones disagree.

Barney moves to Prague.
Barney's time zone is still stored as London (+1) in their profile.
Barney's browsers shows the time zone of Prague (+2) so the time zones disagree.

## Using Browser Time Zones But Keeping Existing Timestamps In UTC

(Continues from the shared setup.)

Barney decides to request a slot of Tom's availability for their activity once more.
The availability's date and time is 2 PM UTC which is 4 PM Prague (+2) time.
Barney is presented with a calendar which shows an availability with slots starting at 4 PM,
because Barney is in the Prague time zone now.

Barney requests the 4 PM slot and the request is stored in universal time, so 2 PM UTC.

Tom reviews their calendar and sees a request. This request is stored with universal time of 2 PM
which in Tom's browser time zone (Albuquerque (+6)) is 8 PM.

Now Barney is going to be expecting Tom at 2 PM their time and Tom is going to need to show up at 8 PM.

Tom replaces the existing availability with a new one better suited to their new location.
He enters the availability time of 4 PM every Wednesday again.
His time zone is stored as Prague (+2) in their profile but the calendar input is inferred
to be in their browser time zone which is Albuquerque (+6) so the availability time is stored as
10 AM UTC, which is 4 PM Albuquerque (+6). Every time this availability is going to be requested,
Tom will know to show up at 4 PM Albuquerque (+6) time.

Barney decides to request this new availability of Tom's.
The availability is stored with the 10 AM UTC timestamp.
Barney is presented with a calendar showing an availability with the first slot at noon, because
their current time zone is Prague (+2) so two hours ahead of the stored UTC timestamp.

## Using Browser Time Zones And Storing Everything With Its Time Zone

(Continues from the shared setup.)

Barney decides to request a slot of Tom's availability for their activity once more.
The availability's date and time is 4 PM Prague (+2) time because that's the TZ it was created with.
Barney is presented with a calendar which shows an availability with slots starting at 4 PM,
because Barney is in the Prague time zone now.

Barney requests the 4 PM slot and the request is stored in Barney's time zone, which is Prague (+2), so 4 PM.

Tom reviews their calendar and sees a request. This request is stored with Prague (+2) time of 4 PM
which in Tom's browser time zone (Albuquerque (+6)) is 8 PM.
This is the difference in the time zone between Tom's profile location time zone (+2) and their actual time zone (+6).

Now Barney is going to be expecting Tom at 4 PM their time and Tom is going to need to show up at 8 PM,
as indicated by the calendar.

Tom replaces the existing availability with a new one better suited to their new location.
He enters the availability time of 4 PM every Wednesday again.
His time zone is stored as Prague (+2) in their profile but the calendar input is inferred
to be in their browser time zone which is Albuquerque (+6) so the availability time is stored as
4 PM Albuquerque (+6). Every time this availability is going to be requested,
Tom will know to show up at 4 PM Albuquerque (+6) time.

Barney decides to request this new availability of Tom's.
The availability is stored with the 4 PM Albuquerque (+6) timestamp.
Barney is presented with a calendar showing an availability with the first slot at noon, because
their current time zone is Prague (+2) which is 4 hours behind Albuquerque (+6).

## Using Profile Time Zones But Keeping Existing Timestamps In UTC

(Continues from the shared setup.)

Barney decides to request a slot of Tom's availability for their activity once more.
The availability's date and time is 2 PM UTC which is 3 PM London (+1) time.
Barney is presented with a calendar which shows an availability with slots starting at 3 PM,
because Barney's profile has London time zone even though their actual time zone is Prague now.

Barney requests the 3 PM slot and the request is stored in universal time, so 1 PM UTC.

Tom reviews their calendar and sees a request. This request is stored with universal time of 1 PM
which in Tom's profile time zone (Prague (+1)) is 3 PM, even though it is 7 PM in Albuquerque (+6) time.
So they are shown a request which is placed at the 3 PM line in the calendar but corresponds to 7 PM
in the location they are currently at.

Now Barney is going to be expecting Tom at 3 PM because that's the line it is at in their calendar
as if they were in London but the actual time is 4 PM because that's what that time is in Prague.
Additionally, Tom's calendar is going to show the request at the 3 PM line (because it was stored
as if those 3 PM was made in the London time zone even though it was in the Prague one) but they
actually need to show up at 7 PM because that's what that time corresponds to in their current
location.

Tom replaces the existing availability with a new one better suited to their new location.
Tom wants to take the call at 4 PM so he needs to make sure it works out to 4 PM Albuquerque (+6) time
because they are entering it in their profile time zone which is Prague (+2). They need to enter
the noon which from Prague to UTC is 10 AM and from UTC to Albuquerque (+6) is 4 PM.
The availability timestamp gets stored as 10 AM UTC time.
Every time this availability is going to get requested, Tom will know it is for 4 PM Albuquerque time.

Barney decides to request this new availability of Tom's.
The availability is stored with the 10 AM UTC timestamp.
Barney is presented with a calendar showing an availability with the first slot at 11 AM, because
their profile time zone is London (+1) so one hour ahead of the stored UTC timestamp.

## Using Profile Time Zones And Storing Everything With Its Time Zone

(Continues from the shared setup.)

Barney decides to request a slot of Tom's availability for their activity once more.
The availability's date and time is 4 PM Prague (+2) time because that's the TZ it was created with.
Barney is presented with a calendar which shows an availability with slots starting at 4 PM,
because Barney is in the Prague time zone now.

Barney requests the 4 PM slot and the request is stored in Barney's time zone, which is Prague (+2), so 4 PM.

Tom reviews their calendar and sees a request. This request is stored with Prague (+2) time of 4 PM
which in Tom's browser time zone (Albuquerque (+6)) is 6 PM, but in their profile time zone (Prague (+2)) it is 4 PM.
Tom sees the slot at 4 PM in the calendar even though it works out to 6 PM Albuquerque (+6) time.

Now Barney is going to be expecting Tom at 4 PM their time and Tom is going to need to show up at 6 PM,
even though the calendar indicates differently.

Tom replaces the existing availability with a new one better suited to their new location.
He enters the availability time of 4 PM every Wednesday again.
His time zone is stored as Prague (+2) in their profile so the availability is stored as 4 PM Prague (+2) time.
That works out to 6 PM Albuequerque (+6) time. This is not what Tom wants so he changes the time to the noon because
the noon in Prague (+2) is 4 PM in Albuquerque which is what Tom wants in their time zone, although the calendar indicates
differently.

Every time this availability is going to be requested, Tom will know to show up at 4 PM Albuquerque (+6) time,
even though into the calendar they entered the noon.

Barney decides to request this new availability of Tom's.
The availability is stored with the noon Prague (+2) timestamp.
Barney is presented with a calendar showing an availability with the first slot at 1 PM, because
their profile time zone is London (+1) even though their current time zone is Prague (+2).

Barney needs to account for his relative location to the time zone in his profile and to show up
at 2 PM in Prague even though his calendar indicates 1 PM as per his profile time zone and Tom
needs to show up at 4 PM in Albuequerque even though his calendar indicates noon as per his Prague
time zone in his profile.

## To-Do
