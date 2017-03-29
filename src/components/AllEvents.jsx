import React, { Component } from 'react';
import Slider from 'react-slick';
import { Card, CardMedia, CardTitle, CardText, CardActions } from 'react-toolbox/lib/card';
import { Button } from 'react-toolbox/lib/button';

class AllEvents extends Component {

	render () {
		console.log('Rendering <AllEvent />');
		var settings = {
			dots: true,
			slidesToShow: 2,
			centerMode: true,
		};


		return (
			<div className="carousel">
				{this.props.data.allEvent[0] ? (
				<Slider {...settings}>
					{this.props.data.allEvent.map((dat, i) => {
						return (
							<div key={i}>
								<Card style={{width: '350px', height: '75%'}} raised>
									<CardTitle
										avatar="https://placeimg.com/80/80/animals"
										title={dat.creator_name}
										subtitle={dat.venue}
									/>
									<CardMedia className="cardImage"
										aspectRatio="square"
										image="https://placeimg.com/800/450/nature"
									/>
									<CardTitle
										title={dat.name}
										subtitle={new Date(dat.start_time).toString().split(' ').slice(0, 5).join(' ')}
									/>
									<CardText>{dat.description}</CardText>
									<CardActions>
										<Button onClick={this.props.addEvent.bind(null, dat.id)} label="Join" />
									</CardActions>
								</Card>
							</div>
						)
					})}
				</Slider>
				) : (
					<h1 className="jumbotron text-muted">No Events</h1>
				)}
			</div>
		)
	}
}

export default AllEvents;
