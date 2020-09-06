import React, { useState, useEffect, useCallback } from 'react'
import axios from 'axios'
import logo from './logo.png'
import spinner from './spinner.svg'
import './App.css'
const apiUrl = 'https://blue-bottle-api-test.herokuapp.com/v1'

function App() {
    const [isLoading, setIsLoading] = useState(true)
    const [apiToken, setApiToken] = useState('')
    const [apiData, setApiData] = useState([])
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
                    </div>
                </div>
            )}
        </div>
    )
}

export default App
