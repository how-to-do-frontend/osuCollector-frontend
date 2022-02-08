import { useHistory, useParams } from 'react-router-dom'
import { useContext, useState, useEffect } from 'react'
import {
  Button,
  Card,
  Col,
  Container,
  Form,
  FormControl,
  Image,
  Modal,
  OverlayTrigger,
  ReactPlaceholder,
  Row,
  Spinner,
  Tooltip,
} from '../bootstrap-osu-collector'
import Alert from 'react-bootstrap/Alert'
import * as api from '../../utils/api'
import FavouriteButton from '../common/FavouriteButton'
import { RectShape } from 'react-placeholder/lib/placeholders'
import './MapsetCard.css'
import MapsetCard from './MapsetCard'
import SortButton from '../common/SortButton'
import InfiniteScroll from 'react-infinite-scroll-component'
import { bpmToColor, starToColor } from '../../utils/misc'
import EditableTextbox from '../common/EditableTextbox'
import { TrashFill, ExclamationTriangleFill, Pencil } from 'react-bootstrap-icons'
import styled, { ThemeContext } from 'styled-components'
import ModeCounters from '../common/ModeCounters'
import BarGraph from '../common/BarGraph'
import { LinkContainer } from 'react-router-bootstrap'
import Comments from './Comments'
import DropdownButton from '../common/DropdownButton'
import moment from 'moment'
import { addFavouritedByUserAttribute } from 'utils/misc'

const groupBeatmapsets = (beatmaps) => {
  if (beatmaps?.length === 0) {
    return []
  }
  let groups = []
  let currentGroup = null
  for (const beatmap of beatmaps) {
    if (currentGroup === null) {
      currentGroup = {
        beatmapset: beatmap.beatmapset,
        beatmaps: [beatmap],
      }
    } else if (beatmap.beatmapset.id === currentGroup.beatmapset.id) {
      currentGroup.beatmaps.push(beatmap)
    } else {
      currentGroup.beatmaps.sort((a, b) => b.difficulty_rating - a.difficulty_rating)
      groups.push(currentGroup)
      currentGroup = {
        beatmapset: beatmap.beatmapset,
        beatmaps: [beatmap],
      }
    }
  }
  groups.push(currentGroup)
  return groups
}

const GraphContainer = styled(Card.Body)`
  background-color: ${(props) => (props.theme.darkMode ? '#121212' : '#eee')};
`

function RenameForm({ collection, setCollection, setRenamingCollection }) {
  const [newCollectionName, setNewCollectionName] = useState('')

  return (
    <Form>
      <div className='d-flex'>
        <FormControl
          className='mr-2'
          size='lg'
          placeholder={collection.name}
          onChange={(event) => setNewCollectionName(event.target.value)}
        />
        <Button
          className='ml-2 mr-1'
          onClick={() => {
            api.renameCollection(collection.id, newCollectionName)
            setCollection({
              ...collection,
              name: newCollectionName,
            })
            setRenamingCollection(false)
          }}
        >
          Rename
        </Button>
        <Button className='mx-1' variant='secondary' onClick={() => setRenamingCollection(false)}>
          Cancel
        </Button>
      </div>
    </Form>
  )
}

function Collection({ user, setUser }) {
  const theme = useContext(ThemeContext)
  const history = useHistory()

  let { id } = useParams()
  const [queryOpts, setQueryOpts] = useState({
    perPage: 50,
    sortBy: 'beatmapset.artist',
    orderBy: 'asc',
    filterMin: undefined,
    filterMax: undefined,
  })
  const [collection, setCollection] = useState(undefined)
  const [beatmapPage, setBeatmapPage] = useState(null)
  const [beatmaps, setBeatmaps] = useState(null)
  const [favourited, setFavourited] = useState(false)
  const [favourites, setFavourites] = useState(0)
  const [currentlyPlaying, setCurrentlyPlaying] = useState(null)

  const onPlayClick = (index) => {
    if (currentlyPlaying === index) {
      setCurrentlyPlaying(null)
    } else {
      setCurrentlyPlaying(index)
    }
  }

  const onAudioEnd = () => {
    setCurrentlyPlaying(null)
  }

  // run this code on initial load
  const refreshCollection = (cancelCallback = undefined) => {
    // GET collection
    api
      .getCollection(id, cancelCallback)
      .then((collection) => {
        addFavouritedByUserAttribute(collection, user)
        setCollection(collection)
        setFavourited(collection.favouritedByUser)
        setFavourites(collection.favourites)
      })
      .catch(console.log)
  }
  useEffect(() => {
    let cancel
    refreshCollection((c) => (cancel = c))
    return cancel
  }, [])

  useEffect(() => {
    // GET beatmaps
    let cancel
    setBeatmapPage(null)
    api
      .getCollectionBeatmaps(
        id,
        undefined, // retrieve first page
        queryOpts.perPage,
        queryOpts.sortBy,
        queryOpts.orderBy,
        queryOpts.filterMin,
        queryOpts.filterMax,
        (c) => (cancel = c)
      )
      .then((_beatmapPage) => {
        setBeatmapPage(_beatmapPage)
        setBeatmaps(_beatmapPage.beatmaps)
      })
      .catch(console.log)
    return cancel
  }, [queryOpts])

  const loadMore = async () => {
    try {
      const _beatmapPage = await api.getCollectionBeatmaps(
        id,
        beatmapPage.nextPageCursor,
        queryOpts.perPage,
        queryOpts.sortBy,
        queryOpts.orderBy,
        queryOpts.filterMin,
        queryOpts.filterMax
      )
      setBeatmapPage(_beatmapPage)
      setBeatmaps([...beatmaps, ..._beatmapPage.beatmaps])
    } catch (err) {
      console.log(err)
    }
  }

  // message modal
  const [showDeleteConfirmationModal, setShowDeleteConfirmationModal] = useState(false)
  const [collectionSuccessfullyDeleted, setCollectionSuccessfullyDeleted] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const submitDescription = (newDescription) => {
    api.editCollectionDescription(collection.id, newDescription)
    setCollection({
      ...collection,
      description: newDescription,
    })
  }
  const [renamingCollection, setRenamingCollection] = useState(false)

  const deleteCollection = async () => {
    setDeleting(true)
    const result = await api.deleteCollection(collection.id)
    setDeleting(false)
    setShowDeleteConfirmationModal(false)
    if (result) {
      setCollectionSuccessfullyDeleted(true)
    } else {
      alert('Delete failed. Check console for more info.')
    }
  }

  const likeButtonClicked = () => {
    if (!collection) return
    if (!user) {
      alert('You must be logged in to favourite collections')
      return
    }

    const favourited = !collection.favouritedByUser
    collection.favouritedByUser = favourited
    setFavourited(favourited)
    if (favourited) {
      api.favouriteCollection(collection.id)
      setFavourites(favourites + 1)
    } else {
      api.unfavouriteCollection(collection.id)
      setFavourites(favourites - 1)
    }
    setUser({
      ...user,
      favourites: favourited
        ? [...user.favourites, collection.id]
        : user.favourites.filter((id) => id !== collection.id),
    })
  }

  const setSortBy = (sortBy) => {
    if (queryOpts.sortBy === sortBy) {
      setQueryOpts({
        ...queryOpts,
        orderBy: queryOpts.orderBy === 'asc' ? 'desc' : 'asc',
      })
    } else {
      setQueryOpts({
        ...queryOpts,
        sortBy: sortBy,
        orderBy: ['beatmapset.artist', 'beatmapset.title', 'beatmapset.creator'].includes(sortBy) ? 'asc' : 'desc',
        filterMin: undefined,
        filterMax: undefined,
      })
    }
  }

  const filterByStar = (star) => {
    if (star === 1) {
      setQueryOpts({
        ...queryOpts,
        sortBy: 'difficulty_rating',
        orderBy: queryOpts.sortBy === 'difficulty_rating' ? queryOpts.orderBy : 'asc',
        filterMin: undefined,
        filterMax: 2,
      })
    } else if (star === 10) {
      setQueryOpts({
        ...queryOpts,
        sortBy: 'difficulty_rating',
        orderBy: queryOpts.sortBy === 'difficulty_rating' ? queryOpts.orderBy : 'asc',
        filterMin: 10,
        filterMax: undefined,
      })
    } else {
      setQueryOpts({
        ...queryOpts,
        sortBy: 'difficulty_rating',
        orderBy: queryOpts.sortBy === 'difficulty_rating' ? queryOpts.orderBy : 'asc',
        filterMin: star,
        filterMax: star + 1,
      })
    }
  }

  const filterByBpm = (bpm) => {
    if (bpm === 150) {
      setQueryOpts({
        ...queryOpts,
        sortBy: 'bpm',
        orderBy: queryOpts.sortBy === 'bpm' ? queryOpts.orderBy : 'asc',
        filterMin: undefined,
        filterMax: 160,
      })
    } else if (bpm === 300) {
      setQueryOpts({
        ...queryOpts,
        sortBy: 'bpm',
        orderBy: queryOpts.sortBy === 'bpm' ? queryOpts.orderBy : 'asc',
        filterMin: 300,
        filterMax: undefined,
      })
    } else {
      setQueryOpts({
        ...queryOpts,
        sortBy: 'bpm',
        orderBy: queryOpts.sortBy === 'bpm' ? queryOpts.orderBy : 'asc',
        filterMin: bpm,
        filterMax: bpm + 10,
      })
    }
  }

  const difficultySpread = collection?.difficultySpread
    ? collection.difficultySpread
    : {
        1: 0,
        2: 0,
        3: 0,
        4: 0,
        5: 0,
        6: 0,
        7: 0,
        8: 0,
        9: 0,
        10: 0,
      }
  const bpmSpread = collection?.bpmSpread
    ? collection.bpmSpread
    : {
        150: 0,
        160: 0,
        170: 0,
        180: 0,
        190: 0,
        200: 0,
        210: 0,
        220: 0,
        230: 0,
        240: 0,
        250: 0,
        260: 0,
        270: 0,
        280: 0,
        290: 0,
        300: 0,
      }
  const listing = beatmaps ? groupBeatmapsets(beatmaps) : new Array(50).fill({})

  if (collectionSuccessfullyDeleted) {
    return (
      <Alert variant='danger'>
        <Alert.Heading className='text-center m-0'>Collection deleted</Alert.Heading>
      </Alert>
    )
  }

  if (collection === null) {
    return <h1>Collection not found!</h1>
  }
  return (
    <Container className='pt-4'>
      {/* collection metadata */}
      <Card className='p-4 pb-0 shadow'>
        <ReactPlaceholder
          ready={collection}
          showLoadingAnimation
          type='rect'
          className='mb-3 w-100'
          style={{ height: '58px' }}
        >
          <div className='d-flex justify-content-between'>
            <div className='d-flex align-content-center'>
              {renamingCollection ? (
                <RenameForm
                  collection={collection}
                  setCollection={setCollection}
                  setRenamingCollection={setRenamingCollection}
                />
              ) : (
                <h1 className='mb-0 mr-4'>{collection?.name}</h1>
              )}
              {collection?.uploader?.id === user?.id && !renamingCollection && (
                <Button variant='outline-secondary' onClick={() => setRenamingCollection(true)} style={{ width: 48 }}>
                  <Pencil className='svg-shadow' size={18} />
                </Button>
              )}
            </div>
            {collection?.uploader?.id === user?.id && (
              <Button
                variant='danger'
                onClick={() => setShowDeleteConfirmationModal(true)}
                className='p-0'
                style={{
                  width: '50px',
                  height: '34px',
                  marginTop: '-6px',
                }}
              >
                <TrashFill className='svg-shadow' size={18} />
              </Button>
            )}
          </div>
        </ReactPlaceholder>
        <ReactPlaceholder
          ready={collection}
          showLoadingAnimation
          type='rect'
          className='w-100 mb-4'
          style={{ height: '304px' }}
        >
          {collection && (
            <Container className='p-0'>
              <Row className='p-0'>
                <Col lg={12} xl={6}>
                  {/* beatmap count grouped by mode */}
                  <div className='mt-2 mb-3 d-flex align-items-center'>
                    <ModeCounters collection={collection} className={undefined} />
                    {(collection.unsubmittedBeatmapCount > 0 || collection.unknownChecksums.length > 0) && (
                      <OverlayTrigger
                        placement='right'
                        overlay={
                          <Tooltip id=''>
                            <div className='px-2'>
                              {collection.unsubmittedBeatmapCount > 0 && (
                                <div>
                                  <small>{collection.unsubmittedBeatmapCount} unsubmitted</small>
                                </div>
                              )}
                              {collection.unknownChecksums.length > 0 && (
                                <div>
                                  <small>{collection.unknownChecksums.length} processing</small>
                                </div>
                              )}
                            </div>
                          </Tooltip>
                        }
                      >
                        <div>
                          <div className='d-flex align-items-center mr-2'>
                            <ExclamationTriangleFill className='mr-1' style={{ color: '#ffd966' }} />
                            <small>
                              {(collection.unsubmittedBeatmapCount || 0) + (collection.unknownChecksums.length || 0)}
                            </small>
                          </div>
                        </div>
                      </OverlayTrigger>
                    )}
                  </div>
                  <div className='mt-1 mb-3 d-flex justify-content-start align-items-center'>
                    {/* uploader */}
                    <Image
                      className='collection-card-uploader-avatar mr-2'
                      src={`https://a.ppy.sh/${collection.uploader.id}`}
                      roundedCircle
                    />
                    <LinkContainer to={`/users/${collection.uploader.id}/uploads`}>
                      <a>{collection.uploader.username}</a>
                    </LinkContainer>
                    {collection.uploader.rank > 0 && (
                      <small className='text-muted ml-1'>#{collection.uploader.rank}</small>
                    )}
                    {/* date */}
                    <small className='text-muted ml-3'>
                      Created {moment.unix(collection.dateUploaded._seconds).fromNow()}
                      {Math.abs(collection.dateLastModified._seconds - collection.dateUploaded._seconds) > 86400 && (
                        <>, updated {moment.unix(collection.dateLastModified._seconds).fromNow()}</>
                      )}
                    </small>
                  </div>
                  {/* description */}
                  <EditableTextbox
                    value={collection.description}
                    isEditable={collection.uploader.id === user?.id}
                    submit={submitDescription}
                  />
                  {/* buttons */}
                  <div className='d-flex flex-row mb-4'>
                    <Button
                      className='mr-1'
                      onClick={() => {
                        if (user?.paidFeaturesAccess) {
                          alert('Please use the osu!Collector desktop client to access this feature.')
                        } else {
                          history.push('/client')
                        }
                      }}
                    >
                      Download maps
                    </Button>
                    <DropdownButton
                      title='Add to osu!'
                      titleAction={() => {
                        if (user?.paidFeaturesAccess) {
                          alert('Please use the osu!Collector desktop client to access this feature.')
                        } else {
                          history.push('/client')
                        }
                      }}
                      menuItems={['Download as collection.db']}
                      menuActions={[
                        async () => {
                          if (user?.paidFeaturesAccess) {
                            // download collection.db
                            let data
                            try {
                              data = await api.downloadCollectionDb(collection.id)
                            } catch (err) {
                              alert(err.message)
                              return
                            }
                            const url = window.URL.createObjectURL(new Blob([data]))
                            const a = document.createElement('a')
                            a.href = url
                            a.download = `${collection.uploader.username} - ${collection.name}.db`
                            document.body.appendChild(a) // we need to append the element to the dom -> otherwise it will not work in firefox
                            a.click()
                            a.remove()
                          } else {
                            history.push('/client')
                          }
                        },
                      ]}
                      style={{
                        width: 202,
                      }}
                    />
                    <FavouriteButton
                      className='mx-1'
                      favourites={favourites}
                      favourited={favourited}
                      onClick={likeButtonClicked}
                    />
                  </div>
                </Col>
                <Col lg={12} xl={6}>
                  {/* Difficulty Spread Graph */}
                  <GraphContainer className='pt-0 pb-2 mb-3' variant='top'>
                    <BarGraph
                      data={[
                        [
                          '',
                          '',
                          { role: 'style' },
                          { role: 'annotation' },
                          { role: 'tooltip', type: 'string', p: { html: true } },
                        ],
                        ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((star) => [
                          star.toString(),
                          difficultySpread[star],
                          starToColor(star, theme.darkMode),
                          difficultySpread[star],
                          `${star}★ - ${difficultySpread[star]} difficulties`,
                        ]),
                      ]}
                      height={116}
                      enableInteractivity
                      chartEvents={[
                        {
                          eventName: 'select',
                          callback: ({ chartWrapper }) => {
                            const chart = chartWrapper.getChart()
                            const selection = chart.getSelection()
                            if (selection.length === 1) {
                              const star = selection[0].row + 1
                              filterByStar(star)
                            }
                          },
                        },
                      ]}
                    />
                    <p className='mt-2 mb-0 text-center text-muted'>
                      click on the chart to filter by{' '}
                      <strong className={theme.darkMode ? 'text-light' : 'text-dark'}>star rating</strong>
                    </p>
                  </GraphContainer>

                  {/* BPM Spread Graph */}
                  <GraphContainer className='pt-0 pb-2 mb-4' variant='top'>
                    <BarGraph
                      data={[
                        [
                          '',
                          '',
                          { role: 'style' },
                          { role: 'annotation' },
                          { role: 'tooltip', type: 'string', p: { html: true } },
                        ],
                        ...[150, 160, 170, 180, 190, 200, 210, 220, 230, 240, 250, 260, 270, 280, 290, 300].map(
                          (bpm) => [
                            bpm.toString(),
                            bpmSpread[bpm],
                            bpmToColor(bpm, theme.darkMode),
                            bpmSpread[bpm],
                            `${bpm} bpm - ${bpmSpread[bpm]} difficulties`,
                          ]
                        ),
                      ]}
                      height={115}
                      enableInteractivity
                      chartEvents={[
                        {
                          eventName: 'select',
                          callback: ({ chartWrapper }) => {
                            const chart = chartWrapper.getChart()
                            const selection = chart.getSelection()
                            if (selection.length === 1) {
                              const bpm = 150 + 10 * selection[0].row
                              filterByBpm(bpm)
                            }
                          },
                        },
                      ]}
                    />
                    <p className='mt-2 mb-0 text-center text-muted'>
                      click on the chart to filter by{' '}
                      <strong className={theme.darkMode ? 'text-light' : 'text-dark'}>bpm</strong>
                    </p>
                  </GraphContainer>
                </Col>
              </Row>
            </Container>
          )}
        </ReactPlaceholder>
      </Card>

      {/* comments */}
      <Comments
        comments={collection?.comments}
        collectionId={collection?.id}
        user={user}
        refreshCollection={refreshCollection}
      />

      {/* beatmaps */}
      <Card className='mt-4 shadow'>
        <Card.Header>
          <div className='d-flex flex-wrap'>
            <div className='p-2 mr-4'>Sort by:</div>
            {[
              ['beatmapset.artist', 'Artist'],
              ['beatmapset.title', 'Title'],
              ['beatmapset.creator', 'Mapper'],
              ['difficulty_rating', 'Stars'],
              ['bpm', 'BPM'],
              ['hit_length', 'Length'],
            ].map(([field, label]) => (
              <div key={field} className='p-1 mr-2'>
                <SortButton
                  sortDirection={queryOpts.sortBy !== field ? null : queryOpts.orderBy}
                  onClick={() => setSortBy(field)}
                  className={undefined}
                >
                  {label}
                </SortButton>
              </div>
            ))}
          </div>
        </Card.Header>
        <Card.Body className={`p-4 ${theme.darkMode ? '' : 'bg-light'}`}>
          <InfiniteScroll
            dataLength={beatmaps?.length || false}
            next={loadMore}
            hasMore={beatmapPage?.hasMore}
            loader={
              <div className='d-flex justify-content-center p-2'>
                <Spinner animation='border' />
              </div>
            }
            endMessage={
              <p className='text-muted' style={{ textAlign: 'center' }}>
                <b>Nothing more to show.</b>
              </p>
            }
            className='row'
          >
            {listing.map(({ beatmapset, beatmaps }, index) => (
              <ReactPlaceholder
                key={index}
                ready={beatmapPage}
                showLoadingAnimation
                type='rect'
                className='w-100 mb-4'
                customPlaceholder={
                  <div className='d-flex'>
                    {/* beatmapset */}
                    <RectShape
                      showLoadingAnimation
                      color='grey'
                      className='mr-2'
                      style={{ width: '470px', height: '100px' }}
                    />
                    {/* diffs */}
                    <RectShape showLoadingAnimation color='grey' className='mr-0' rows={1} style={{ height: '41px' }} />
                  </div>
                }
              >
                <MapsetCard
                  className='mb-4'
                  beatmapset={beatmapset}
                  beatmaps={beatmaps}
                  playing={currentlyPlaying === index}
                  onPlayClick={() => onPlayClick(index)}
                  onAudioEnd={onAudioEnd}
                />
              </ReactPlaceholder>
            ))}
          </InfiniteScroll>
        </Card.Body>
      </Card>

      <Modal show={showDeleteConfirmationModal} onHide={() => setShowDeleteConfirmationModal(false)} centered={true}>
        <Modal.Body>Are you sure you want to delete this collection?</Modal.Body>
        <Modal.Footer>
          <Button variant='secondary' onClick={() => setShowDeleteConfirmationModal(false)} disabled={deleting}>
            No
          </Button>
          <Button variant='danger' onClick={deleteCollection} disabled={deleting}>
            {deleting ? <Spinner size='sm' animation='border'></Spinner> : 'Yes'}
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  )
}

export default Collection
