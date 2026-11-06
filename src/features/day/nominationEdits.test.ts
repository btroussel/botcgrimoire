import { contentPin } from '../../content'
import { onTheBlock, today } from '../../engine'
import { game, kill } from '../../engine/testing/board'
import { append, appendAll, boardOf, openSession, redo, undo } from '../../store/session'
import { deserialize, mintGameId, SAVED_VERSION, serialize } from '../../store/saved'
import { cancelNomination, confirmNomination, resetNominationVotes } from './nominationEdits'

const prepare = () => {
  const fixture = game().seat('Alice', 'chef').seat('Bob', 'imp').seat('Ghost', 'monk')
    .night(1, [kill('Ghost')]).day().build()
  const session = openSession({ version: SAVED_VERSION, id: mintGameId(), createdAt: 1, updatedAt: 1,
    script: 'tb', content: contentPin, mode: 'free', playTime: [], log: fixture.log })
  const nominated = appendAll(session, [
    { kind: 'markForExecution', seat: null },
    { kind: 'nominate', by: fixture.id('Alice'), of: fixture.id('Bob') },
  ], 2)
  const nomination = today(boardOf(nominated))!.nominations[0]!
  const voted = append(nominated, { kind: 'vote', nomination: nomination.opened, seat: fixture.id('Ghost'), weight: 1, free: true }, 3)
  return { session: voted, id: fixture.id }
}

test('Reset clears hands and total but preserves the nomination, ghost votes and other ballots', () => {
  const { session, id } = prepare()
  const withOther = appendAll(session, [
    { kind: 'nominate', by: id('Bob'), of: id('Alice') },
    { kind: 'markForExecution', seat: id('Alice') },
  ], 4)
  const before = today(boardOf(withOther))!.nominations
  const reset = appendAll(withOther, resetNominationVotes(withOther.game.log, before[0]!), 5)
  const board = boardOf(reset)
  expect(today(board)!.nominations[0]).toEqual({ ...before[0], votes: [], weight: 0 })
  expect(today(board)!.nominations[1]).toEqual(before[1])
  expect(board.seats.find(s => s.id === id('Ghost'))!.ghostVote).toBe(true)
  expect(onTheBlock(board)).toBe(id('Alice'))
  expect(today(boardOf(undo(reset, 6)))!.nominations).toEqual(before)
})

test('cancelling an unconfirmed vote spends no ghost vote', () => {
  const { session, id } = prepare()
  const nomination = today(boardOf(session))!.nominations[0]!
  const cancelled = appendAll(session, cancelNomination(session.game.log, nomination), 4)
  const board = boardOf(cancelled)
  expect(today(board)!.nominations).toEqual([])
  expect(board.seats.find(s => s.id === id('Ghost'))!.ghostVote).toBe(true)
  expect(onTheBlock(board)).toBeUndefined()
})

test('Mark consumes the dead voter token and places the marker as one undoable, reloadable action', () => {
  const { session, id } = prepare()
  const board = boardOf(session)
  const marked = appendAll(session, confirmNomination(board, session.game.log, today(board)!.nominations[0]!), 4)
  const restored = openSession(deserialize(serialize(marked.game)))
  expect(boardOf(restored).seats.find(s => s.id === id('Ghost'))!.ghostVote).toBe(false)
  expect(onTheBlock(boardOf(restored))).toBe(id('Bob'))
  expect(boardOf(restored).seats.find(s => s.id === id('Bob'))!.alive).toBe(true)
  const undone = undo(restored, 5)
  expect(boardOf(undone).seats.find(s => s.id === id('Ghost'))!.ghostVote).toBe(true)
  expect(onTheBlock(boardOf(undone))).toBeUndefined()
  expect(onTheBlock(boardOf(redo(undone, 6)))).toBe(id('Bob'))
  const cancelled = appendAll(restored, cancelNomination(restored.game.log, today(boardOf(restored))!.nominations[0]!), 7)
  expect(today(boardOf(cancelled))!.nominations).toEqual([])
  expect(boardOf(cancelled).seats.find(s => s.id === id('Ghost'))!.ghostVote).toBe(true)
  expect(onTheBlock(boardOf(cancelled))).toBeUndefined()
})

test('Done records the tally and spends the dead voter\'s token but leaves the marker where it was', () => {
  const { session, id } = prepare()
  const leader = appendAll(session, [{ kind: 'markForExecution', seat: id('Alice') }], 4)
  const nomination = today(boardOf(leader))!.nominations[0]!
  const edits = confirmNomination(boardOf(leader), leader.game.log, nomination, { mark: false })
  expect(edits).toEqual(confirmNomination(boardOf(leader), leader.game.log, nomination).filter(e => e.kind !== 'markForExecution'))
  const done = appendAll(leader, edits, 5)
  const board = boardOf(openSession(deserialize(serialize(done.game))))
  expect(today(board)!.nominations[0]).toEqual({ ...nomination, weight: 1 })
  expect(board.seats.find(s => s.id === id('Ghost'))!.ghostVote).toBe(false)
  expect(onTheBlock(board)).toBe(id('Alice'))
  const cancelled = appendAll(done, cancelNomination(done.game.log, today(boardOf(done))!.nominations[0]!), 6)
  expect(boardOf(cancelled).seats.find(s => s.id === id('Ghost'))!.ghostVote).toBe(true)
  expect(onTheBlock(boardOf(cancelled))).toBe(id('Alice'))
})

test('cancelling never restores a token spent before this nomination or overwrites a later manual edit', () => {
  const { session, id } = prepare()
  const spentBefore = append(session, { kind: 'setGhostVote', seat: id('Ghost'), available: false }, 4)
  const board = boardOf(spentBefore)
  const marked = appendAll(spentBefore, confirmNomination(board, spentBefore.game.log, today(board)!.nominations[0]!), 5)
  const cancelled = appendAll(marked, cancelNomination(marked.game.log, today(boardOf(marked))!.nominations[0]!), 6)
  expect(boardOf(cancelled).seats.find(s => s.id === id('Ghost'))!.ghostVote).toBe(false)

  const confirmed = appendAll(session, confirmNomination(boardOf(session), session.game.log, today(boardOf(session))!.nominations[0]!), 4)
  const edited = appendAll(confirmed, [{ kind: 'setGhostVote', seat: id('Ghost'), available: false }, { kind: 'markForExecution', seat: id('Alice') }], 5)
  const corrected = appendAll(edited, cancelNomination(edited.game.log, today(boardOf(edited))!.nominations[0]!), 6)
  expect(boardOf(corrected).seats.find(s => s.id === id('Ghost'))!.ghostVote).toBe(false)
  expect(onTheBlock(boardOf(corrected))).toBe(id('Alice'))
})

test('removing a previously confirmed dead hand returns its token on the next confirmation', () => {
  const { session, id } = prepare()
  const nomination = today(boardOf(session))!.nominations[0]!
  const marked = appendAll(session, confirmNomination(boardOf(session), session.game.log, nomination), 4)
  const edited = append(marked, { kind: 'unvote', nomination: nomination.opened, seat: id('Ghost'), weight: 1 }, 5)
  const saved = appendAll(edited, confirmNomination(boardOf(edited), edited.game.log, today(boardOf(edited))!.nominations[0]!), 6)
  expect(boardOf(saved).seats.find(s => s.id === id('Ghost'))!.ghostVote).toBe(true)
  expect(today(boardOf(saved))!.nominations[0]!.weight).toBe(0)
})

test('a dead voter with no ghost vote left is counted and spends nothing', () => {
  const { session, id } = prepare()
  const spent = append(session, { kind: 'setGhostVote', seat: id('Ghost'), available: false }, 4)
  const nomination = today(boardOf(spent))!.nominations[0]!
  const edits = confirmNomination(boardOf(spent), spent.game.log, nomination, { mark: false })
  expect(edits).toEqual([{ kind: 'setVoteTotal', nomination: nomination.opened, total: 1 }])
})
