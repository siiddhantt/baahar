import { calendarUrl } from './client';

describe('calendarUrl', () => {
  it('escapes the occurrence identifier', () => {
    expect(calendarUrl('event/with spaces')).toContain('/v1/events/event%2Fwith%20spaces.ics');
  });
});
