import React, { useState, useEffect, useCallback } from 'react'
import BubbleChart from '@weknow/react-bubble-chart-d3'
import axios from 'axios'
import logo from './logo.png'
import spinner from './spinner.svg'
import './App.css'

const apiUrl = 'https://blue-bottle-api-test.herokuapp.com/v1'
const coffeeShopsShown = 3
const coffeeShopNameDelimiter = 'Blue Bottle '

function App() {
    const [isLoading, setIsLoading] = useState(true)
    const [apiToken, setApiToken] = useState('')
    const [apiData, setApiData] = useState([])
    const [processedApiData, setProcessedApiData] = useState([])
    const [userCoordinates, setUserCoordinates] = useState({})

    const getToken = async () => {
        try {
            const response = await axios({
                url: `${apiUrl}/tokens`,
                method: 'post',
            })
            setApiToken(response.data.token)
        } catch (error) {
            console.error(error)
        }
    }

    useEffect(() => {
        const getUserCoordinates = () => {
            navigator.geolocation.getCurrentPosition((position) => {
                setUserCoordinates({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                })
            })
        }
        getToken()
        getUserCoordinates()
    }, [])

    const distanceByCoordinates = useCallback(
        (latitude, longitude) => {
            if (userCoordinates.latitude) {
                var p = 0.017453292519943295 // Math.PI / 180
                var c = Math.cos
                var a =
                    0.5 -
                    c((latitude - userCoordinates.latitude) * p) / 2 +
                    (c(userCoordinates.latitude * p) *
                        c(latitude * p) *
                        (1 - c((longitude - userCoordinates.longitude) * p))) /
                        2
                return (
                    Math.round(
                        (12742 * Math.asin(Math.sqrt(a)) + Number.EPSILON) * 100
                    ) / 100
                ) // 2 * R; R = 6371 km
            } else {
                return false
            }
        },
        [userCoordinates.latitude, userCoordinates.longitude]
    )

    useEffect(() => {
        const getApiData = async () => {
            if (apiToken) {
                try {
                    const response = await axios({
                        url: `${apiUrl}/coffee_shops?token=${apiToken}`,
                        method: 'get',
                        headers: {
                            Accept: 'application/json',
                        },
                    })
                    switch (response.status) {
                        case 200:
                            response.data.forEach((coffeeShop) => {
                                coffeeShop.distance = distanceByCoordinates(
                                    coffeeShop.x,
                                    coffeeShop.y
                                )
                            })
                            setApiData(response.data)
                            break
                        case 401:
                            console.log('401: Token invalid. Retrying.')
                            getToken()
                            break
                        case 406:
                            console.log('406: Unacceptable Accept format.')
                            break
                        case 503:
                            console.log('503: Service Unavailable')
                            break
                        case 504:
                            console.log('504: Timeout.  Retrying.')
                            getToken()
                            break
                        default:
                            console.log(
                                'Unprocessed HTTP status code: ',
                                response.status
                            )
                    }
                } catch (error) {
                    console.error(error)
                }
            }
        }
        getApiData()
    }, [apiToken, distanceByCoordinates])

    useEffect(() => {
        if (apiData && userCoordinates.latitude && userCoordinates.longitude) {
            let graphCoffeeShopsData = []

            if (apiData.length > 0) {
                apiData.sort((a, b) => (a.distance > b.distance ? 1 : -1))
                apiData.forEach((coffeeShop, index) => {
                    index < coffeeShopsShown &&
                        graphCoffeeShopsData.push({
                            label: coffeeShopNameDelimiter
                                ? coffeeShop.name
                                      .split(coffeeShopNameDelimiter)
                                      .pop()
                                : coffeeShop.name,
                            value: 1,
                            color: '#03dac6',
                            customTooltip: `${distanceByCoordinates(
                                coffeeShop.x,
                                coffeeShop.y
                            )} km`,
                        })
                })
                graphCoffeeShopsData.push({
                    label: 'User',
                    value: 1,
                    customTooltip: false,
                    color: '#3700b3',
                })
            }
            setProcessedApiData(graphCoffeeShopsData)
        }
    }, [
        apiData,
        distanceByCoordinates,
        userCoordinates.latitude,
        userCoordinates.longitude,
    ])

    useEffect(() => {
        if (
            apiToken &&
            apiData &&
            userCoordinates.latitude &&
            userCoordinates.longitude
        ) {
            setIsLoading(false)
        }
    }, [apiData, apiToken, userCoordinates.latitude, userCoordinates.longitude])
    return (
        <div className="app">
            {isLoading ? (
                <div className="spinnerWrapper">
                    <img src={spinner} className="spinner" alt="spinner" />
                </div>
            ) : (
                <div>
                    <header className="header">
                        <div>Coffee Shop Finder</div>
                        <img src={logo} className="logo" alt="logo" />
                    </header>
                    <div className="mainContainer">
                        <div className="userCoordinatesWrapper">
                            <code>Latitude: {userCoordinates.latitude}</code>
                            <br />
                            <code>Longitude: {userCoordinates.longitude}</code>
                        </div>
                        {processedApiData.length > 0 && (
                            <div>
                                <BubbleChart
                                    width={700}
                                    height={700}
                                    padding={400}
                                    showLegend={false}
                                    showValue={false}
                                    showAnimations={false}
                                    labelFont={{
                                        family: 'Arial',
                                        size: 16,
                                        color: '#fff',
                                        weight: 'bold',
                                    }}
                                    data={processedApiData}
                                    overflow={true}
                                ></BubbleChart>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

export default App
