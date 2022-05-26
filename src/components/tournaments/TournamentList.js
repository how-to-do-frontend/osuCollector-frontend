import { Col, Container, ReactPlaceholder, Spinner } from '../bootstrap-osu-collector'
import InfiniteScroll from 'react-infinite-scroll-component'
import TournamentCard from './TournamentCard'

export default function TournamentList({ tournaments, hasMore, loadMore }) {
  return (
    <Container className="p-2">
      <InfiniteScroll
        dataLength={tournaments.length}
        next={loadMore}
        hasMore={hasMore}
        loader={
          <div className="d-flex justify-content-center p-2">
            <Spinner animation="border" />
          </div>
        }
        endMessage={
          <p className="text-muted" style={{ textAlign: 'center' }}>
            <b>Nothing more to show.</b>
          </p>
        }
        className="row"
      >
        {tournaments.map((tournament, i) => (
          <Col lg={6} xl={6} className="p-0 my-3" key={i}>
            <ReactPlaceholder
              ready={tournament !== null}
              showLoadingAnimation
              type="rect"
              className="mx-auto"
              style={{ width: '90%', height: '235px' }}
            >
              {tournament && <TournamentCard tournament={tournament} />}
            </ReactPlaceholder>
          </Col>
        ))}
      </InfiniteScroll>
    </Container>
  )
}
