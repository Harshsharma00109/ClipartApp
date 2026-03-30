import { useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, Image, StyleSheet,
  ScrollView, ActivityIndicator, Alert, Dimensions
} from 'react-native';
import * as MediaLibrary from 'expo-media-library';
import * as ImagePicker from 'expo-image-picker';
import { WebView } from 'react-native-webview';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

const { width } = Dimensions.get("window");

const STYLES = [
  { id: 'cartoon', label: '🎨 Cartoon' },
  { id: 'sketch', label: '✏️ Sketch' },
  { id: 'pixel', label: '🕹 Pixel' },
  { id: 'flat', label: '🧩 Flat' },
  { id: 'anime', label: '🔥 Anime' },
];

const PROCESSOR_HTML = `
<!DOCTYPE html>
<html>
<body>
<canvas id="c"></canvas>
<script>
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');

function cartoon(img){
  canvas.width=400;canvas.height=400;
  ctx.drawImage(img,0,0,400,400);
  ctx.filter="contrast(140%) saturate(140%)";
  ctx.drawImage(canvas,0,0);
  ctx.filter="none";
}

function sketch(img){
  canvas.width=400;canvas.height=400;
  ctx.drawImage(img,0,0,400,400);
  ctx.filter="grayscale(100%) contrast(200%)";
  ctx.drawImage(canvas,0,0);
  ctx.filter="none";
}

function pixel(img){
  canvas.width=50;canvas.height=50;
  ctx.drawImage(img,0,0,50,50);
  const temp=canvas.toDataURL();
  const img2=new Image();
  img2.onload=function(){
    canvas.width=400;canvas.height=400;
    ctx.imageSmoothingEnabled=false;
    ctx.drawImage(img2,0,0,400,400);
    send();
  }
  img2.src=temp;
}

function flat(img){
  canvas.width=400;canvas.height=400;
  ctx.drawImage(img,0,0,400,400);
  const d=ctx.getImageData(0,0,400,400);
  const px=d.data;
  for(let i=0;i<px.length;i+=4){
    px[i]=Math.round(px[i]/80)*80;
    px[i+1]=Math.round(px[i+1]/80)*80;
    px[i+2]=Math.round(px[i+2]/80)*80;
  }
  ctx.putImageData(d,0,0);
}

function anime(img){
  canvas.width=400;canvas.height=400;
  ctx.drawImage(img,0,0,400,400);
  ctx.filter="saturate(300%) contrast(180%) brightness(110%)";
  ctx.drawImage(canvas,0,0);
  ctx.filter="none";
}

function send(){
  const result=canvas.toDataURL('image/png');
  window.ReactNativeWebView.postMessage(result);
}

document.addEventListener("message",function(e){
  const data=JSON.parse(e.data);
  const img=new Image();

  img.onload=function(){
    if(data.style==="cartoon") cartoon(img);
    if(data.style==="sketch") sketch(img);
    if(data.style==="pixel") pixel(img);
    if(data.style==="flat") flat(img);
    if(data.style==="anime") anime(img);

    if(data.style!=="pixel") send();
  }

  img.src=data.image;
});
</script>
</body>
</html>
`;

export default function HomeScreen() {
  const [image, setImage] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, string>>({});
  const [loadingStyle, setLoadingStyle] = useState<string | null>(null);

  const webRef = useRef<WebView>(null);

  // 📸 Pick Image
  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission required");
      return;
    }

    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      base64: true,
      quality: 0.6,
    });

    if (!res.canceled) {
      const base64 = "data:image/jpeg;base64," + res.assets[0].base64;
      setImage(base64);
      setResults({});
    }
  };

  // 🎨 Generate Style
  const generateStyle = (styleId: string) => {
    if (!image) return;

    setLoadingStyle(styleId);

    webRef.current?.postMessage(JSON.stringify({
      image,
      style: styleId
    }));
  };

  // 📩 Receive Result
  const onMessage = (e: any) => {
    const result = e.nativeEvent.data;

    setResults(prev => ({
      ...prev,
      [loadingStyle as string]: result
    }));

    setLoadingStyle(null);
  };

  // 📥 Download (NEW API)
 const downloadImage = async (uri: string) => {
  try {
    const base64Data = uri.replace("data:image/png;base64,", "");

    const file = new File(Paths.cache, "clipart-download.png");

    await file.write(base64Data, { encoding: 'base64' });

    Alert.alert(
      "Download",
      "File prepared. Use 'Share' → 'Save to device'"
    );

  } catch (err) {
    console.log(err);
    Alert.alert("❌ Download failed");
  }
};
  const shareImage = async (uri: string) => {
  try {
    const base64Data = uri.replace("data:image/png;base64,", "");

    const file = new File(Paths.cache, "clipart-share.png");

    await file.write(base64Data, { encoding: 'base64' });

    await Sharing.shareAsync(file.uri);

  } catch (err) {
    console.log(err);
    Alert.alert("❌ Share failed");
  }
};

  return (
    <View style={s.container}>
      <WebView
        ref={webRef}
        source={{ html: PROCESSOR_HTML }}
        onMessage={onMessage}
        javaScriptEnabled
        domStorageEnabled
        style={{ height: 0, width: 0 }}
      />

      <ScrollView>

        <Text style={s.title}>🎨 ClipArt Generator</Text>

        <TouchableOpacity style={s.btn} onPress={pickImage}>
          <Text style={s.txt}>Upload Image</Text>
        </TouchableOpacity>

        {image && <Image source={{ uri: image }} style={s.preview} />}

        {image && (
          <View style={s.row}>
            {STYLES.map(style => (
              <TouchableOpacity
                key={style.id}
                style={s.styleBtn}
                onPress={() => generateStyle(style.id)}
              >
                <Text style={s.txt}>{style.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={s.grid}>
          {STYLES.map(style => (
            <View key={style.id} style={s.card}>
              <Text style={s.label}>{style.label}</Text>

              {loadingStyle === style.id ? (
                <ActivityIndicator color="white" />
              ) : results[style.id] ? (
                <>
                  <Image source={{ uri: results[style.id] }} style={s.result} />

                 <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>

  <TouchableOpacity
    onPress={() => downloadImage(results[style.id])}
    style={s.downloadBtn}
  >
    <Text style={{ color: "#fff", fontSize: 12 }}>Download</Text>
  </TouchableOpacity>

  <TouchableOpacity
    onPress={() => shareImage(results[style.id])}
    style={[s.downloadBtn, { backgroundColor: "#22c55e" }]}
  >
    <Text style={{ color: "#fff", fontSize: 12 }}>Share</Text>
  </TouchableOpacity>

</View>
                </>
              ) : (
                <Text style={{ color: "#555" }}>No Image</Text>
              )}
            </View>
          ))}
        </View>

      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000", padding: 15 },

  title: {
    color: "#fff",
    fontSize: 24,
    textAlign: "center",
    marginBottom: 20
  },

  btn: {
    backgroundColor: "#7c3aed",
    padding: 15,
    borderRadius: 12,
    marginBottom: 10
  },

  txt: {
    color: "#fff",
    textAlign: "center",
    fontWeight: "bold"
  },

  preview: {
    width: 200,
    height: 200,
    alignSelf: "center",
    marginVertical: 10,
    borderRadius: 10
  },

  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center"
  },

  styleBtn: {
    backgroundColor: "#ff4d6d",
    padding: 10,
    margin: 5,
    borderRadius: 8
  },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginTop: 20
  },

  card: {
    width: (width / 2) - 20,
    backgroundColor: "#111",
    padding: 10,
    marginBottom: 15,
    borderRadius: 12,
    alignItems: "center"
  },

  label: {
    color: "#fff",
    marginBottom: 5
  },

  result: {
    width: "100%",
    height: 150,
    borderRadius: 8
  },

  downloadBtn: {
    backgroundColor: "#7c3aed",
    padding: 6,
    marginTop: 6,
    borderRadius: 6
  }
});