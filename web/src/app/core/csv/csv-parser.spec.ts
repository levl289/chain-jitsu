import { parseCsv } from './csv-parser';

describe('parseCsv', () => {
  it('parses simple rows keyed by the header', () => {
    expect(parseCsv('a,b\n1,2\n3,4')).toEqual([
      { a: '1', b: '2' },
      { a: '3', b: '4' },
    ]);
  });

  it('keeps commas inside quoted fields', () => {
    expect(parseCsv('a,b\n"x,y",z')).toEqual([{ a: 'x,y', b: 'z' }]);
  });

  it('unescapes doubled quotes', () => {
    expect(parseCsv('a\n"he said ""hi"""')).toEqual([{ a: 'he said "hi"' }]);
  });

  it('supports newlines inside quoted fields', () => {
    expect(parseCsv('a,b\n"line1\nline2",z')).toEqual([
      { a: 'line1\nline2', b: 'z' },
    ]);
  });

  it('normalises CRLF and skips blank trailing lines', () => {
    expect(parseCsv('a,b\r\n1,2\r\n')).toEqual([{ a: '1', b: '2' }]);
  });

  it('returns nothing for empty input or header only', () => {
    expect(parseCsv('')).toEqual([]);
    expect(parseCsv('a,b')).toEqual([]);
  });
});
