import React, { useState, useEffect, useCallback, useLayoutEffect } from 'react'
import axios from 'axios'
import logo from './logo.png'
import spinner from './spinner.svg'
import * as am4core from '@amcharts/amcharts4/core'
import * as am4maps from '@amcharts/amcharts4/maps'
import am4themes_dark from '@amcharts/amcharts4/themes/dark'
import am4geodata_worldLow from '@amcharts/amcharts4-geodata/worldLow'
import './App.css'

am4core.useTheme(am4themes_dark)

const apiUrl = 'https://blue-bottle-api-test.herokuapp.com/v1'
const coffeeShopsShown = 10
const coffeeShopNameDelimiter = false // 'Blue Bottle '

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
                            title: coffeeShopNameDelimiter
                                ? coffeeShop.name
                                      .split(coffeeShopNameDelimiter)
                                      .pop()
                                : coffeeShop.name,
                            latitude: parseFloat(coffeeShop.x),
                            longitude: parseFloat(coffeeShop.y),
                            color: '#009ED9',
                            customTooltip: `${distanceByCoordinates(
                                coffeeShop.x,
                                coffeeShop.y
                            )} km`,
                        })
                })
                graphCoffeeShopsData.push({
                    title: 'User',
                    latitude: userCoordinates.latitude,
                    longitude: userCoordinates.longitude,
                    color: 'red',
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

    const animateBullet = useCallback((circle) => {
        let animation = circle.animate(
            [
                { property: 'scale', from: 1, to: 5 },
                { property: 'opacity', from: 1, to: 0 },
            ],
            1000,
            am4core.ease.circleOut
        )
        animation.events.on('animationended', function (event) {
            animateBullet(event.target.object)
        })
    }, [])

    useLayoutEffect(() => {
        let chart = am4core.create('chartdiv', am4maps.MapChart)

        chart.geodata = am4geodata_worldLow
        chart.projection = new am4maps.projections.Miller()
        chart.seriesContainer.draggable = false
        chart.seriesContainer.resizable = false
        chart.maxZoomLevel = 1

        let polygonSeries = chart.series.push(new am4maps.MapPolygonSeries())
        polygonSeries.exclude = ['AQ']
        polygonSeries.useGeodata = true

        let polygonTemplate = polygonSeries.mapPolygons.template
        polygonTemplate.tooltip = false
        polygonTemplate.interactionsEnabled = false

        let hs = polygonTemplate.states.create('hover')
        hs.properties.fill = chart.colors.getIndex(0)

        let imageSeries = chart.series.push(new am4maps.MapImageSeries())
        imageSeries.mapImages.template.propertyFields.longitude = 'longitude'
        imageSeries.mapImages.template.propertyFields.latitude = 'latitude'
        imageSeries.mapImages.template.tooltipText = `[bold]{title}[/]
        {customTooltip}`

        let circle = imageSeries.mapImages.template.createChild(am4core.Circle)
        circle.radius = 5
        circle.propertyFields.fill = 'color'

        let circle2 = imageSeries.mapImages.template.createChild(am4core.Circle)
        circle2.radius = 5
        circle2.propertyFields.fill = 'color'

        circle2.events.on('inited', function (event) {
            animateBullet(event.target)
        })

        imageSeries.data = processedApiData
        console.log(processedApiData)
        return () => {
            chart.dispose()
        }
    }, [animateBullet, processedApiData])

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
                        <div
                            id="chartdiv"
                            style={{
                                width: '100%',
                                height: '500px',
                                marginTop: '20px',
                            }}
                        ></div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default App
