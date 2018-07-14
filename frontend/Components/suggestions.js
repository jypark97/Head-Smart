import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ListView,
  Alert,
  Button,
  RefreshControl,
  AsyncStorage
} from "react-native"
import { LinearGradient } from "expo";

export default class SuggestionsScreen extends React.Component {
  constructor(){
    super();
    const ds = new ListView.DataSouce({
      rowHasChanged: (r1, r2) => r1 !== r2
    });

    fetch('')
    .then((res)=> res.json())
    .then((res2)=> this.setState({renderList:ds.cloneWithRows(res2)}))
    this.state={
      renderList: []
    }
  }

  render(){
    return(
      <View>
          <LinearGradient style={{height:"100%"}} colors={["#7fd64d", "#4dd6ba"]} >
          <ListView dataSource={this.state.renderList}
          renderRow={item => (
            <View>
              <Text>
                {item.name}
              </Text>
            </View>
          )}

            />
          </LinearGradient>
      </View>
    )
  }
}