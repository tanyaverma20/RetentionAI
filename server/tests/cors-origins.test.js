import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createOriginMatcher, describeUnsafeOriginPattern } from '../src/config/corsOrigins.js';

describe('createOriginMatcher', () => {
  it('matches an exact origin', () => {
    const isAllowed = createOriginMatcher(['https://retention-ai-five.vercel.app']);
    assert.equal(isAllowed('https://retention-ai-five.vercel.app'), true);
  });

  it('rejects an origin that is not in the allowlist', () => {
    const isAllowed = createOriginMatcher(['https://retention-ai-five.vercel.app']);
    assert.equal(isAllowed('https://evil.example.com'), false);
  });

  it('does not treat the scheme as interchangeable', () => {
    const isAllowed = createOriginMatcher(['https://retention-ai-five.vercel.app']);
    assert.equal(isAllowed('http://retention-ai-five.vercel.app'), false);
  });

  it('matches every per-deploy URL for one Vercel project', () => {
    const isAllowed = createOriginMatcher(['https://retention-*-tanya-b0e5.vercel.app']);
    assert.equal(isAllowed('https://retention-kh76ar1u2-tanya-b0e5.vercel.app'), true);
    assert.equal(isAllowed('https://retention-pofh289nw-tanya-b0e5.vercel.app'), true);
  });

  it('confines a wildcard to a single DNS label', () => {
    const isAllowed = createOriginMatcher(['https://retention-*-tanya-b0e5.vercel.app']);
    // An attacker-controlled host that only *contains* the pinned segments
    // must not match — the wildcard cannot span a dot.
    assert.equal(isAllowed('https://retention-x.evil.com-tanya-b0e5.vercel.app'), false);
    assert.equal(isAllowed('https://retention-a-tanya-b0e5.vercel.app.evil.com'), false);
  });

  it('requires the wildcard to consume at least one character', () => {
    const isAllowed = createOriginMatcher(['https://retention-*-tanya-b0e5.vercel.app']);
    assert.equal(isAllowed('https://retention--tanya-b0e5.vercel.app'), false);
  });

  it('is case-insensitive on the host', () => {
    const isAllowed = createOriginMatcher(['https://Retention-AI-Five.vercel.app']);
    assert.equal(isAllowed('https://retention-ai-five.vercel.app'), true);
  });

  it('allows any entry in a multi-entry allowlist to match', () => {
    const isAllowed = createOriginMatcher([
      'https://retention-ai-five.vercel.app',
      'https://retention-*-tanya-b0e5.vercel.app',
    ]);
    assert.equal(isAllowed('https://retention-ai-five.vercel.app'), true);
    assert.equal(isAllowed('https://retention-kh76ar1u2-tanya-b0e5.vercel.app'), true);
    assert.equal(isAllowed('https://retention-ai-five.vercel.app.evil.com'), false);
  });
});

describe('describeUnsafeOriginPattern', () => {
  it('accepts an exact origin', () => {
    assert.equal(describeUnsafeOriginPattern('https://retention-ai-five.vercel.app'), null);
  });

  it('accepts a wildcard that pins a team segment', () => {
    assert.equal(describeUnsafeOriginPattern('https://retention-*-tanya-b0e5.vercel.app'), null);
  });

  it('rejects a bare wildcard', () => {
    assert.notEqual(describeUnsafeOriginPattern('*'), null);
  });

  it('rejects a whole-domain wildcard that would trust every Vercel tenant', () => {
    assert.notEqual(describeUnsafeOriginPattern('https://*.vercel.app'), null);
  });

  it('rejects a wildcard host with no literal text at all', () => {
    assert.notEqual(describeUnsafeOriginPattern('https://*'), null);
  });

  // Regression: a wildcard flush against one edge of its DNS label (no
  // literal on that side) is exploitable on a shared platform domain just
  // like `*.vercel.app` is — anyone can register a project/team name that
  // supplies the missing side. Only requiring literal text on BOTH sides of
  // the star (as the accepted "pins a team segment" case above does) closes
  // this. Confirmed exploitable pre-fix: createOriginMatcher(['https://retention-*.vercel.app'])
  // matched 'https://retention-anything-attackerteam.vercel.app'.
  it('rejects a suffix-only wildcard with no literal after the star', () => {
    assert.notEqual(describeUnsafeOriginPattern('https://retention-*.vercel.app'), null);
  });

  it('rejects a prefix-only wildcard with no literal before the star', () => {
    assert.notEqual(describeUnsafeOriginPattern('https://*-tanya-b0e5.vercel.app'), null);
  });
});
