import * as fs from 'fs'
import * as path from 'path'
import { parse } from '../src/parse';

const a = fs.readFileSync(path.join(__dirname, './fixtures/a.md')).toString()

describe('parseMarkdown', () => {
  it('should parse markdown', () => {
    const result = parse(a);
    expect(result).toMatchSnapshot();
  });
});
