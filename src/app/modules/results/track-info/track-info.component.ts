import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, ParamMap } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { TrackService } from '../../../services/track.service';
import { Track } from 'src/app/models/track';
import { LoadingService } from '../../../services/loading.service';
import { TrackLyrics, SpotifyTrack, TrackFeatures } from '../../../models/track';
import { FirebaseService } from '../../../services/firebase.service';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'app-track-info',
  templateUrl: './track-info.component.html',
  styleUrls: ['./track-info.component.scss']
})
export class TrackInfoComponent implements OnInit {

  trackId: string;
  trackName: string;
  trackInfo: Track;
  spotifyResults: SpotifyTrack[];
  spotifyTrack: SpotifyTrack;
  trackFeatures: TrackFeatures;
  lyricsInfo: TrackLyrics;
  videoId: string;
  trackTime: string;
  currentDate = new Date().toDateString();
  dateFlag: boolean;

  constructor(private route: ActivatedRoute, private firebaseService: FirebaseService, private webTitle: Title, private trackService: TrackService, public loading: LoadingService, private datePipe: DatePipe) {
    this.currentDate = this.datePipe.transform(this.currentDate, 'yyyy-MM-dd');
  }

  ngOnInit(): void {
    this.route.paramMap.subscribe((paramMap: ParamMap) => {
      this.trackId = paramMap.get('id');
      this.getInfo();
    });
  }

  getInfo(): void {
    this.loading.startLoading();
    this.firebaseService.getTrack(this.trackId).subscribe(track => {
      if(track){
        this.timestampCheck(this.currentDate, track.dateSaved);
        if(this.dateFlag === false){
          this.trackInfo = track.trackInfo;
          this.spotifyTrack = track.spotifyTrack;
          this.trackFeatures = track.trackFeatures;
          this.trackService.getTrackLyrics(this.trackInfo.primary_artist.name, this.trackInfo.title).subscribe(res => {
            this.lyricsInfo = res.result;
          });
          try{
            this.pullIdFromVideoUrl();
          }
          catch(error)
          {
            console.error(error);
          }
          if(this.trackFeatures !== undefined){
            this.formatTrackTime();
          }
          this.webTitle.setTitle(`${this.trackInfo.title}'s page`);
          this.loading.finishLoading();
        } else {
          this.getApiInfo();
        }
      } else {
        this.getApiInfo();
      }
    });
  }

  pullIdFromVideoUrl(){
    if(this.trackInfo.media){
      const media = this.trackInfo.media.find(media => media.type === 'video');
      const lastEqualSignIndex = media.url.lastIndexOf('=');
      this.videoId = media.url.substr(lastEqualSignIndex + 1);
    }
  }

  formatTrackTime(){
    let seconds = this.trackFeatures.duration_ms / 1000;
    let minutes = seconds / 60;
    seconds = Math.floor(seconds) % 60;
    minutes = Math.floor(minutes) % 60;
    let stringMinutes = minutes.toLocaleString();
    let stringSeconds = seconds.toLocaleString();
    if(seconds.toString().length < 2){
      stringSeconds = '0' + stringSeconds;
    }
    this.trackTime =`${stringMinutes}:${stringSeconds}`;
  }

  saveTrackInfo(){
    let trackInfo = {};
    if(this.spotifyTrack === undefined){
      trackInfo = {
        trackInfo: this.trackInfo,
        dateSaved: this.currentDate
      };
    } else {
      trackInfo = {
        trackInfo: this.trackInfo,
        spotifyTrack: this.spotifyTrack,
        trackFeatures: this.trackFeatures,
        dateSaved: this.currentDate
      };
    }
    this.firebaseService.saveTrackData(this.trackId, trackInfo);
  }

  timestampCheck(currentDate, olderDate){
    this.dateFlag = false;
    var d1 = Date.parse(currentDate);
    var d2 = Date.parse(olderDate);
    d1 = (d1 / (60*60*24*1000));
    d2 = (d2 / (60*60*24*1000));
    if(d1 - d2 >= 7){
      this.dateFlag = true;
    }
    return this.dateFlag;
  }

  getApiInfo(){ //pobieranie danych o utworze z API
    setTimeout(() => {
      //pobieranie informacji o utworze z Genius
      this.trackService.getTrackInfo(this.trackId).subscribe(res => {
        this.trackInfo = res.response.song;
        //pobieranie informacji o utworze ze Spotify poprzez przekazanie nazwy utworu i artysty z Genius
        this.trackService.getSpotifyTrackInfo(`${this.trackInfo.title} ${this.trackInfo.primary_artist.name}`).subscribe(res => {
          this.spotifyResults = res.tracks.items;
          this.spotifyTrack = this.spotifyResults[0];
          if(this.spotifyTrack === undefined){ //jeśli nie ma utworu w Spotify, przejdź od razu do pobrania tekstu z Lyrics API
            this.trackService.getTrackLyrics(this.trackInfo.primary_artist.name, this.trackInfo.title).subscribe(res => {
              this.lyricsInfo = res.result;
            });
            this.saveTrackInfo(); //zapisanie obiektu danych do bazy
            try{
              this.pullIdFromVideoUrl(); //wyciąganie ID z adresu URL wideo w YouTube
            }
            catch(error)
            {
              console.error(error); //jeśli nie ma wideo w YouTube, wyświetl błąd w konsoli
            }
          } else { //jeśli utwór jest w Spotify, pobierz dane z analizy audio
            this.trackService.getSpotifyTrackFeatures(`${this.spotifyTrack.id}`).subscribe(res => {
              this.trackFeatures = res;
              //pobieranie tekstu utworu z Lyrics API
              this.trackService.getTrackLyrics(this.trackInfo.primary_artist.name, this.trackInfo.title).subscribe(res => {
                this.lyricsInfo = res.result;
              });
              this.saveTrackInfo(); //zapisanie obiektu danych do bazy
              try{
                this.pullIdFromVideoUrl();
              }
              catch(error)
              {
                console.error(error); //jeśli nie ma wideo w YouTube, wyświetl błąd w konsoli
              }
              this.formatTrackTime(); //przetworzenie długości utworu na format 'mm:ss'
            });
          }
        });
        this.loading.finishLoading();
        this.webTitle.setTitle(`${this.trackInfo.title} page`);
      })
    }, 2000);
  }
}
