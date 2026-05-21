# BAB II A: SPESIFIKASI TEKNOLOGI MEDIA PEMBELAJARAN IoT

## Pendahuluan

Media pembelajaran Internet of Things yang dikembangkan dalam skripsi ini merupakan sistem berbasis web yang menghubungkan perangkat keras IoT dengan antarmuka pembelajaran interaktif. Sistem ini dirancang untuk membantu mahasiswa Program Studi Pendidikan Teknik Mekatronika memahami konsep dasar Internet of Things, komunikasi data real-time, dan pengelolaan data terstruktur melalui pengalaman belajar yang langsung dan aplikatif.

Pemilihan teknologi dalam skripsi ini tidak dilakukan secara acak. JavaScript, WebSocket, dan MySQL dipilih sebagai fondasi utama karena ketiganya mendukung karakter sistem yang interaktif, responsif, dan mudah dipahami oleh mahasiswa teknik. JavaScript memberi landasan pengembangan antarmuka sekaligus logika aplikasi sisi server. WebSocket mendukung komunikasi dua arah secara langsung antara perangkat dan dashboard. MySQL menyediakan penyimpanan data relasional yang rapi, aman, dan mudah dianalisis. Kombinasi ketiganya membentuk struktur teknis yang sejalan dengan tujuan akademik media pembelajaran ini.

## 1. JavaScript sebagai Bahasa Pemrograman Utama

JavaScript menjadi bahasa utama dalam pengembangan media pembelajaran ini karena sifatnya yang fleksibel dan mudah diadaptasi pada sisi antarmuka. Bahasa ini digunakan pada file login.html, register.html, dashboard.html, dan public-view.html untuk menangkap input pengguna, memproses event tombol, memvalidasi data awal, dan memperbarui tampilan secara dinamis. Dalam konteks pembelajaran, JavaScript memberi keuntungan karena mahasiswa dapat langsung melihat hubungan antara aksi pengguna dan perubahan yang muncul di layar tanpa harus berpindah bahasa pemrograman.

Pemilihan JavaScript juga relevan dengan tujuan pembelajaran karena bahasa ini mendukung konsep asynchronous programming yang sangat penting pada sistem berbasis Internet of Things. Pada media pembelajaran ini, data tidak datang dalam satu kali proses, melainkan terus mengalir dari perangkat ke server dan dari server ke dashboard. JavaScript menyediakan mekanisme seperti Promise dan async/await yang memudahkan pengelolaan proses tersebut tanpa memblokir alur utama aplikasi. Dengan demikian, JavaScript berfungsi bukan hanya sebagai alat implementasi, tetapi juga sebagai medium untuk memahami pola kerja aplikasi modern yang berbasis event-driven.

## 2. Node.js sebagai Runtime Server-Side

Node.js digunakan sebagai runtime environment untuk menjalankan JavaScript di sisi server. Melalui Node.js, file index.js dapat menjalankan logika aplikasi, autentikasi, pengaturan koneksi, dan komunikasi data secara efisien. Dalam penelitian tentang performa layanan web, Node.js juga menunjukkan kemampuan yang memadai untuk menangani akses data pada aplikasi berbasis web (Amarulloh, Kurniasih, dan Muchlis, 2023). Hal ini memperkuat alasan pemilihan Node.js sebagai fondasi server dalam media pembelajaran ini.

Pada implementasinya, Node.js memungkinkan server menangani request login, registrasi, pengiriman token, dan pengaturan koneksi dengan pendekatan non-blocking. Karakter ini penting dalam sistem IoT karena server harus mampu merespons banyak proses secara bersamaan tanpa menimbulkan penundaan yang berarti. Dari sudut pandang pedagogis, Node.js membantu mahasiswa memahami bahwa JavaScript tidak hanya berfungsi di browser, tetapi juga dapat digunakan untuk membangun server aplikasi yang stabil dan responsif.

## 3. WebSocket sebagai Kanal Komunikasi Real-Time

WebSocket dipilih karena protokol ini mampu menyediakan komunikasi dua arah yang bersifat persisten. Berbeda dengan HTTP yang bekerja melalui pola request-response, WebSocket memungkinkan server dan klien saling mengirim data kapan saja setelah koneksi terbentuk. Karakteristik ini sangat sesuai untuk media pembelajaran IoT, sebab data sensor perlu ditampilkan segera pada dashboard, sementara perintah pengguna juga harus diteruskan ke perangkat tanpa jeda yang panjang. Penelitian awal tentang WebSocket menegaskan bahwa protokol ini efektif untuk menampilkan data real-time secara langsung pada aplikasi interaktif (Pimentel dan Nickerson, 2012).

Dalam implementasi skripsi ini, WebSocket digunakan sebagai penghubung utama antara ESP32, server, dan dashboard. Perangkat IoT mengirim data sensor ke server melalui koneksi WebSocket. Server kemudian meneruskan data tersebut ke dashboard yang sedang aktif. Pada saat yang sama, dashboard juga dapat mengirim perintah balik ke perangkat melalui jalur yang sama. Pola ini membentuk komunikasi dua arah yang sederhana namun sangat kuat untuk kebutuhan pembelajaran. Dalam studi terkait platform IoT berbasis WebSocket, pendekatan ini juga dinilai tepat karena mampu mendukung pertukaran data perangkat dan antarmuka pengguna secara cepat dan stabil (Kojansow, Manembu, dan Rumagit, 2024).

Di dalam file index.js, WebSocket diatur sebagai broker komunikasi yang menerima koneksi dari dua jenis klien, yaitu perangkat IoT dan dashboard pengguna. Setiap koneksi divalidasi terlebih dahulu sebelum diizinkan masuk ke dalam sistem. Setelah itu, server mencatat koneksi aktif dan menentukan rute pesan berdasarkan identitas pengguna atau perangkat. Mekanisme ini penting dalam konteks akademik karena mahasiswa dapat memahami bagaimana sistem real-time dibangun, bukan hanya bagaimana data dikirim. Mereka belajar bahwa komunikasi real-time memerlukan manajemen koneksi, pengaturan identitas, dan penanganan pesan secara terstruktur.

WebSocket juga penting untuk mendukung pengalaman belajar yang lebih konkret. Saat mahasiswa melihat perubahan pada sensor di perangkat, perubahan itu langsung muncul di dashboard. Saat mahasiswa mengirim perintah, respons perangkat juga tampil segera. Hubungan sebab-akibat seperti ini membuat materi Internet of Things menjadi lebih mudah dipahami. Dengan demikian, WebSocket tidak hanya berfungsi sebagai protokol teknis, tetapi juga sebagai sarana untuk memperkuat pemahaman konseptual mahasiswa terhadap sistem IoT yang bekerja secara langsung dan dinamis.

## 4. MySQL sebagai Basis Data Relasional

MySQL dipilih sebagai sistem manajemen basis data karena mampu menyimpan data terstruktur dengan relasi yang jelas antar tabel. Dalam media pembelajaran ini, MySQL digunakan untuk menyimpan data pengguna, data perangkat, dan riwayat pembacaan sensor. Struktur relasional seperti ini sesuai untuk sistem pembelajaran karena memudahkan penelusuran data, menjaga konsistensi, dan mendukung analisis historis. Kajian perbandingan MySQL dengan MongoDB menunjukkan bahwa MySQL tetap kuat digunakan ketika sistem membutuhkan data relasional yang teratur dan mudah dikelola (Matallah, Belalem, dan Bouamrane, 2021).

Di dalam skripsi ini, MySQL berperan pada lapisan penyimpanan data yang menopang proses autentikasi dan histori sensor. Saat pengguna melakukan registrasi, sistem menyimpan data akun ke tabel pengguna. Saat perangkat IoT terhubung, sistem mencatat identitas perangkat dan relasinya dengan pengguna. Ketika sensor mengirim data baru, nilai tersebut disimpan ke tabel log sensor agar dapat diakses kembali untuk keperluan riwayat, visualisasi, atau evaluasi pembelajaran. Dengan cara ini, MySQL membantu mahasiswa memahami bahwa data IoT tidak hanya diproses secara langsung, tetapi juga perlu disimpan agar dapat dianalisis secara longitudinal.

Pemakaian MySQL dalam skripsi ini juga memberi ruang bagi mahasiswa untuk belajar tentang desain basis data relasional. Mereka dapat melihat bagaimana satu pengguna dapat memiliki beberapa perangkat, dan bagaimana satu perangkat dapat menghasilkan banyak catatan sensor. Struktur tersebut mengajarkan konsep one-to-many relationship secara nyata. Selain itu, mahasiswa juga belajar bahwa keamanan data tidak hanya ditentukan oleh antarmuka, tetapi juga oleh cara data disimpan di server. Karena itu, MySQL menjadi komponen penting yang memperkuat nilai akademik media pembelajaran ini.

## 5. Express sebagai Web Framework

Express adalah web framework minimal untuk Node.js yang digunakan untuk mengelola routing dan penyajian file web. Dalam media pembelajaran ini, Express bertanggung jawab untuk menentukan endpoint HTTP, menangani request dari klien, dan mengirimkan response dengan benar. Framework ini memudahkan implementasi karena menyediakan API yang sederhana untuk define routes dan middleware tanpa menambah kompleksitas yang tidak perlu.

Pada sisi pedagogi, Express mengajarkan mahasiswa tentang bagaimana HTTP layer bekerja secara eksplisit. Mahasiswa memahami request-response cycle bukan sebagai magic black box, tetapi sebagai alur yang dapat diatur dan dikontrol dengan kode. Dengan Express, mereka belajar bahwa server web tidak hanya sekadar menjalankan aplikasi, tetapi juga harus routing request yang masuk ke handler yang sesuai.

## 6. JWT untuk Manajemen Sesi Stateless

JWT atau JSON Web Token dipakai untuk menjaga sesi pengguna secara stateless. Setelah pengguna berhasil login, server mengeluarkan token yang dapat disimpan di browser dan dikirim kembali pada setiap request berikutnya untuk memverifikasi identitas pengguna. Pendekatan ini berbeda dari session tradisional yang menyimpan data di server, sehingga lebih efisien dan scalable untuk aplikasi yang perlu diakses dari berbagai perangkat.

Dari perspektif pembelajaran, JWT membantu mahasiswa memahami trade-off antara simplicity dan security. Mereka belajar bahwa token tidak boleh menyimpan data sensitif, bahwa token harus di-sign untuk mencegah forgery, dan bahwa token perlu expiration untuk membatasi waktu validitasnya. Konsep ini penting untuk membangun aplikasi web yang aman.

## 7. Bcrypt untuk Keamanan Password

Bcrypt adalah algoritma hashing yang dirancang khusus untuk melindungi password. Ketika pengguna mendaftar, password yang mereka input tidak disimpan langsung di database, melainkan di-hash menggunakan bcrypt terlebih dahulu. Pendekatan ini memastikan bahwa bahkan jika database bocor, password pengguna tidak dapat langsung diketahui karena bcrypt adalah one-way function yang tidak dapat di-reverse.

Penggunaan bcrypt dalam media pembelajaran mengajarkan mahasiswa tentang security fundamentals. Mereka memahami bahwa password harus diperlakukan dengan sangat hati-hati, bahwa plaintext password storage adalah kesalahan fatal, dan bahwa hashing adalah cara yang tepat untuk melindungi credential pengguna. Ini adalah knowledge yang critical untuk setiap developer yang akan bekerja dengan user data.

## 8. CORS untuk Kontrol Akses Lintas Domain

CORS atau Cross-Origin Resource Sharing adalah mekanisme keamanan browser yang mengontrol apakah request dari satu domain dapat mengakses resource dari domain lain. Dalam media pembelajaran ini, CORS diatur agar dashboard yang diakses via IP address dapat berkomunikasi dengan server tanpa permission errors. CORS memerlukan server mengirimkan header khusus yang memberitahu browser bahwa cross-origin access diizinkan.

Dari sisi pembelajaran, CORS mengajarkan mahasiswa tentang security boundaries di web. Mereka memahami bahwa browser tidak begitu saja mengizinkan cross-origin request karena alasan keamanan, bahwa server harus explicitly allow cross-origin access, dan bahwa CORS bukan penghapusan security, tetapi kontrol yang lebih granular. Understanding ini penting untuk develop aplikasi yang aman sekaligus accessible.

## 9. Implementasi dalam Skripsi

Jika dilihat dari alur kerja sistem, JavaScript mengatur interaksi pada sisi pengguna dan logika pada sisi server. WebSocket menangani pertukaran data real-time antara dashboard dan perangkat IoT. MySQL menyimpan data akun, data perangkat, dan data sensor secara relasional. Ketiganya bekerja bersama di dalam index.js, dashboard.html, login.html, register.html, dan modul basis data yang digunakan sistem. Dengan struktur tersebut, mahasiswa dapat mempelajari hubungan langsung antara antarmuka web, komunikasi jaringan, dan penyimpanan data.

Pendekatan ini penting bagi skripsi karena tujuan utamanya bukan sekadar membuat sistem monitoring IoT, melainkan mengembangkan media pembelajaran yang mampu memperlihatkan proses kerja teknologi secara utuh. Mahasiswa tidak hanya melihat hasil akhir, tetapi juga memahami alasan teknis di balik pemilihan teknologi. Mereka belajar mengapa JavaScript dipakai sebagai bahasa utama, mengapa WebSocket dipilih untuk komunikasi real-time, dan mengapa MySQL digunakan untuk penyimpanan data relasional. Alur ini membuat media pembelajaran lebih kuat secara pedagogis dan lebih relevan dengan kebutuhan pembelajaran teknik.

## 10. Kesimpulan

Berdasarkan uraian di atas, JavaScript, WebSocket, dan MySQL merupakan tiga teknologi utama yang paling relevan untuk membangun media pembelajaran IoT berbasis web dalam skripsi ini. JavaScript memberikan fondasi pengembangan yang fleksibel dan mudah dipahami. WebSocket menyediakan komunikasi real-time yang sesuai dengan karakter IoT. MySQL mendukung penyimpanan data yang terstruktur dan dapat diandalkan. Ketiga teknologi ini saling melengkapi dan membentuk sistem yang tidak hanya fungsional, tetapi juga mendidik.

Dengan pemilihan teknologi tersebut, media pembelajaran yang dikembangkan dapat menjelaskan konsep Internet of Things secara lebih konkret kepada mahasiswa Program Studi Pendidikan Teknik Mekatronika. Sistem ini menunjukkan bahwa pembelajaran teknologi akan lebih efektif ketika mahasiswa dapat melihat langsung hubungan antara antarmuka, komunikasi data, dan basis data dalam satu ekosistem yang terintegrasi.

## 11. Daftar Jurnal yang Digunakan

Jurnal yang digunakan sebagai rujukan utama dalam bagian ini adalah Jurnal Teknik Informatika STMIK Antar Bangsa, Jurnal Teknik Informatika, IEEE Internet Computing, dan International Journal of Software Science and Computational Intelligence. Keempat jurnal tersebut dipilih karena memuat artikel yang relevan dengan JavaScript, Node.js, WebSocket, dan MySQL.

## 12. Daftar Pustaka

Amarulloh, A., Kurniasih, K., & Muchlis, M. (2023). Analisis perbandingan performa web service REST menggunakan framework Laravel, Django, dan Node JS untuk akses data dengan aplikasi website. Jurnal Teknik Informatika STMIK Antar Bangsa, 9(1), 14-19. https://doi.org/10.51998/jti.v9i1.515

Kojansow, C. W., Manembu, P. D. K., & Rumagit, A. M. (2024). Pengembangan platform Internet Of Things (IoT) menggunakan komunikasi WebSocket. Jurnal Teknik Informatika, 19(3), 259-269. https://doi.org/10.35793/jti.v19i3.53680

Matallah, H., Belalem, G., & Bouamrane, K. (2021). Comparative study between the MySQL relational database and the MongoDB NoSQL database. International Journal of Software Science and Computational Intelligence, 13(3), 38-63. https://doi.org/10.4018/ijssci.2021070104

Pimentel, V., & Nickerson, B. G. (2012). Communicating and displaying real-time data with WebSocket. IEEE Internet Computing, 16(4), 45-53. https://doi.org/10.1109/mic.2012.64
