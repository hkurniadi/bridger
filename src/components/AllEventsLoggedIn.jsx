import React, { Component } from 'react';
import Slider from 'react-slick';
import { Card, CardMedia, CardTitle, CardText, CardActions } from 'react-toolbox/lib/card';
import { Button } from 'react-toolbox/lib/button';

class AllEvents extends Component {

  render () {
    console.log('Rendering <AllEvent />');
    var settings = {
      dots: true,
      // autoplay: true,
      // autoplaySpeed: 5000,
      // pauseOnHover: true,
    };
    window.innerWidth < 900 ? settings.slidesToShow = 1 : settings.slidesToShow = 3;

    return (
      <div className="carouselLoggedIn">
        {this.props.data.allEvent[0] ? (
        <Slider {...settings}>
          {this.props.data.allEvent.map((dat, i) => {
            return (
              <div key={i}>
                <Card className="carouselCard">
                  <CardTitle
                    avatar={dat.creator_picture_url ? dat.creator_picture_url : "http://vignette2.wikia.nocookie.net/filthy-frank/images/c/ce/Question-mark-face.jpg/revision/latest?cb=20160909100759"}
                    title={dat.creator_name}
                    subtitle={dat.venue}
                  />
                  <CardMedia className="cardImage"
                    aspectRatio="square"
                    image={dat.picture_url ? dat.picture_url: "https://placeimg.com/80/80/nature"}
                  />
                  <CardTitle
                    title={dat.name}
                    subtitle={new Date(dat.start_time).toString().split(' ').slice(0, 5).join(' ')}
                  />
                  <CardText>{dat.description}</CardText>
                  <CardActions>
                    <Button className="joinButton" onClick={this.props.addEvent.bind(null, dat.id)} label="Join Event" />
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