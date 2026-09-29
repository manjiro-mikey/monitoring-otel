# 6. Cài Vector

Đây là collector đầu tiên nên triển khai.

Vector hiện có APT repository chính thức; cách cài đặt được tài liệu
Vector hướng dẫn là thêm repo rồi `apt-get install vector`.

Chạy:

    bash -c "$(curl -L https://setup.vector.dev)"

Sau đó:

    sudo apt-get update
    sudo apt-get install -y vector

Kiểm tra:

    vector --version

Ví dụ:

    vector 0.58.0

------------------------------------------------------------------------

# 7. Kiểm tra Vector service

    sudo systemctl status vector

Nếu cần:

    sudo systemctl enable vector
    sudo systemctl start vector

Config mặc định thường nằm ở:

    /etc/vector/vector.yaml

và `data_dir` là nơi Vector lưu state như file checkpoints và disk
buffers.

------------------------------------------------------------------------

# 8. Tạo thư mục log test

Ví dụ:

    sudo mkdir -p /var/log/apps

Tạo file:

    sudo touch /var/log/apps/application.log

Cho Vector đọc:

    sudo chmod 644 /var/log/apps/application.log

------------------------------------------------------------------------

# 9. Cấu hình Vector theo config của bạn

Backup config cũ:

    sudo cp /etc/vector/vector.yaml \
           /etc/vector/vector.yaml.bak

Sau đó:

    sudo vi /etc/vector/vector.yaml

Dùng:

    data_dir: /var/lib/vector

    sources:

      application_logs:
        type: file

        include:
          - /var/log/apps/*.log

        read_from: end

      journald:
        type: journald

        current_boot_only: true


    transforms:

      normalize_app:
        type: remap

        inputs:
          - application_logs

        source: |
          .service = "application"
          .environment = "lab"


      normalize_journal:
        type: remap

        inputs:
          - journald

        source: |
          .service = "system"
          .environment = "lab"


    sinks:

      victorialogs:
        type: http

        inputs:
          - normalize_app
          - normalize_journal

        uri: "http://172.31.9.5:8427/insert/jsonline?_stream_fields=host,source&_msg_field=message"

        method: post

        auth:
          strategy: basic
          user: "vector_logs"
          password: "YOUR_VECTOR_LOGS_PASSWORD"

        encoding:
          codec: json

        framing:
          method: newline_delimited

        compression: gzip

        batch:
          max_bytes: 1000000
          timeout_secs: 2

        healthcheck:
          enabled: false

Đây phù hợp với HTTP JSON sink mà VictoriaLogs hỗ trợ cho Vector;
VictoriaLogs cũng tài liệu hóa chính các tham số `_stream_fields`,
`_msg_field`, `_time_field`.

------------------------------------------------------------------------

# 10. Có một điểm tôi muốn sửa trong config của bạn

Hiện tại:

    _stream_fields=host,source

nhưng transform lại chỉ tạo:

    .service = "application"
    .environment = "lab"

Bạn **chưa chắc có `host` và `source`**.

Tôi khuyên thêm metadata rõ ràng:

    normalize_app:
      type: remap

      inputs:
        - application_logs

      source: |
        .service = "application"
        .environment = "lab"
        .source = "file"

        if !exists(.host) {
          .host = get_hostname!()
        }

Và journald:

    normalize_journal:
      type: remap

      inputs:
        - journald

      source: |
        .service = "system"
        .environment = "lab"
        .source = "journald"

        if !exists(.host) {
          .host = get_hostname!()
        }

Sau đó:

    uri: "http://172.31.9.5:8427/insert/jsonline?_stream_fields=host,source&_msg_field=message"

sẽ hợp lý hơn.

------------------------------------------------------------------------

# 11. Test syntax Vector

**Không restart ngay.**

Trước tiên:

    sudo vector validate /etc/vector/vector.yaml

Nếu đúng:

    √ Loaded ["/etc/vector/vector.yaml"]
    √ Component configuration
    √ Health checks

Nếu lỗi, sửa config trước.

------------------------------------------------------------------------

# 12. Restart Vector

    sudo systemctl restart vector

Kiểm tra:

    sudo systemctl status vector

Xem log:

    sudo journalctl -u vector -f

Nếu muốn xem khoảng thời gian gần nhất:

    sudo journalctl -u vector --since "5 minutes ago"

------------------------------------------------------------------------

# 13. Tạo log test

Chạy:

    echo '{"level":"INFO","message":"hello vector","app":"demo"}' \
      | sudo tee -a /var/log/apps/application.log

Sau đó:

    sudo journalctl -u vector -f

Bạn cần kiểm tra Vector không báo:

    401
    403
    404
    connection refused
    timeout

------------------------------------------------------------------------

# 14. Kiểm tra VictoriaLogs

Query:

    curl -G \
      'http://172.31.9.5:9428/select/logsql/query' \
      --data-urlencode 'query=message:"hello vector"'

Nếu hệ thống của bạn bắt buộc query thông qua vmauth thì tạo thêm route
cho:

    /select/*

Ví dụ:

    users:

      - username: "vector_logs"
        password: "YOUR_VECTOR_LOGS_PASSWORD"

        url_map:

          - src_paths:
              - "/insert/.*"
            url_prefix:
              - "http://127.0.0.1:9428/"

          - src_paths:
              - "/select/.*"
            url_prefix:
              - "http://127.0.0.1:9428/"

Nhưng production tôi thường tách user ingestion và query user thay vì
cho collector có quyền query.

------------------------------------------------------------------------

# 15. Kiểm tra trên VMUI

VictoriaLogs có UI query tại:

    http://172.31.9.5:9428/select/vmui

VictoriaLogs có built-in UI để query log.

Thử:

    *

hoặc:

    service:application

Bạn sẽ thấy các field kiểu:

    _time
    _msg
    service
    environment
    host
    source
    level
    app

Lưu ý: mặc dù input của Vector có field:

    message

VictoriaLogs sẽ xử lý field được chỉ định bởi:

    _msg_field=message

thành message nội bộ `_msg`.

------------------------------------------------------------------------

# 16. Cài Fluent Bit

Bây giờ tạo **một server test khác**, hoặc ít nhất một directory/file
khác.

Fluent Bit có package chính thức cho Ubuntu. Với Ubuntu, tài liệu hiện
tại hướng dẫn thêm GPG key + APT repository rồi cài `fluent-bit`.

Cài:

    sudo sh -c \
      'curl https://packages.fluentbit.io/fluentbit.key | gpg --dearmor > /usr/share/keyrings/fluentbit-keyring.gpg'

Xác định codename:

    codename=$(grep -oP '(?<=VERSION_CODENAME=).*' /etc/os-release)
    echo $codename

Ví dụ:

    jammy

Thêm repo:

    echo "deb [signed-by=/usr/share/keyrings/fluentbit-keyring.gpg] https://packages.fluentbit.io/ubuntu/$codename $codename main" \
      | sudo tee /etc/apt/sources.list.d/fluent-bit.list

Cài:

    sudo apt-get update
    sudo apt-get install -y fluent-bit

Enable:

    sudo systemctl enable fluent-bit
    sudo systemctl start fluent-bit

Check:

    sudo systemctl status fluent-bit

------------------------------------------------------------------------

# 17. Fluent Bit → VictoriaLogs

VictoriaLogs có hướng dẫn chính thức cho Fluent Bit qua HTTP output và
JSON Lines.

Config:

    sudo vi /etc/fluent-bit/fluent-bit.conf

Ví dụ:

    [SERVICE]
        Flush        1
        Daemon       Off
        Log_Level    info


    [INPUT]
        Name              tail
        Path              /var/log/apps/*.log
        Tag               application
        Read_from_Head    Off
        DB                /var/lib/fluent-bit/app.db


    [FILTER]
        Name    modify
        Match   application

        Add     service application
        Add     environment lab


    [OUTPUT]
        Name              http
        Match             *
        Host              172.31.9.5
        Port              8427
        URI               /insert/jsonline?_stream_fields=host,source&_msg_field=message
        Format            json_lines

        HTTP_User         vector_logs
        HTTP_Passwd       YOUR_VECTOR_LOGS_PASSWORD

        Compress          gzip

Sau đó:

    sudo systemctl restart fluent-bit

Check:

    sudo journalctl -u fluent-bit -f

------------------------------------------------------------------------

# 18. Fluent Bit khác Vector ở đâu?

Sau khi triển khai:

    Fluent Bit
        │
        │ HTTP
        ▼
    vmauth
        │
        ▼
    VictoriaLogs

còn Vector:

    Vector
        │
        │ HTTP
        ▼
    vmauth
        │
        ▼
    VictoriaLogs

Bạn có thể cho cả hai đọc **hai file test khác nhau**:

    /var/log/apps/vector.log
    /var/log/apps/fluent-bit.log

Sau đó:

    source=vector
    source=fluent-bit

để so sánh.

------------------------------------------------------------------------

# 19. Cài Fluentd

Đối với Fluentd, hiện tại **không nên dùng `td-agent`** vì các bản
td-agent cũ đã EOL. Fluentd hiện cung cấp `fluent-package`; tài liệu
hiện tại có package cho Ubuntu 22.04/24.04.

Ubuntu 24.04:

    curl -fsSL \
      https://fluentd.cdn.cncf.io/sh/install-ubuntu-noble-fluent-package6-lts.sh \
      | sh

Ubuntu 22.04:

    curl -fsSL \
      https://fluentd.cdn.cncf.io/sh/install-ubuntu-jammy-fluent-package6-lts.sh \
      | sh

Sau đó:

    sudo systemctl enable fluentd
    sudo systemctl start fluentd

Check:

    sudo systemctl status fluentd

Config chính:

    /etc/fluent/fluentd.conf

Đây là path được Fluentd documentation xác nhận cho `fluent-package`.

------------------------------------------------------------------------

# 20. Fluentd → VictoriaLogs

VictoriaLogs có HTTP output configuration chính thức cho Fluentd.

Ví dụ:

    <source>
      @type tail

      path /var/log/apps/*.log
      pos_file /var/log/fluent/apps.pos

      tag application

      <parse>
        @type json
      </parse>
    </source>


    <filter application>
      @type record_transformer

      <record>
        service application
        environment lab
      </record>
    </filter>


    <match application>

      @type http

      endpoint http://172.31.9.5:8427/insert/jsonline

      headers {
        "VL-Msg-Field": "message",
        "VL-Stream-Fields": "host,source"
      }

    </match>

Nếu log là plain text thay vì JSON thì parse khác:

    <parse>
      @type none
    </parse>

và bạn cần đảm bảo field message được map đúng.

------------------------------------------------------------------------

# 21. Cài Telegraf

Telegraf nên dùng cho metrics.

Cài repository:

    curl --silent --location -O \
      https://repos.influxdata.com/influxdata-archive.key

Verify fingerprint:

    gpg --show-keys \
      --with-fingerprint \
      --with-colons \
      ./influxdata-archive.key

Fingerprint hiện tại được InfluxData công bố cho Ubuntu 20.04+ là:

    24C975CBA61A024EE1B631787C3D57159FC2F927

Sau đó:

    cat influxdata-archive.key \
      | gpg --dearmor \
      | sudo tee /etc/apt/keyrings/influxdata-archive.gpg > /dev/null

Add repo:

    echo 'deb [signed-by=/etc/apt/keyrings/influxdata-archive.gpg] https://repos.influxdata.com/debian stable main' \
      | sudo tee /etc/apt/sources.list.d/influxdata.list

Install:

    sudo apt-get update
    sudo apt-get install -y telegraf

Các bước này theo installation documentation hiện tại của Telegraf.

------------------------------------------------------------------------

# 22. Cấu hình Telegraf

File:

    /etc/telegraf/telegraf.conf

Tôi khuyên trước tiên chỉ lấy:

    CPU
    Memory
    Disk
    Disk IO
    Network

Ví dụ:

    [agent]
      interval = "10s"
      round_interval = true

      metric_batch_size = 1000
      metric_buffer_limit = 10000

      collection_jitter = "0s"
      flush_interval = "10s"
      flush_jitter = "0s"

      hostname = ""

      omit_hostname = false


    [[inputs.cpu]]
      percpu = true
      totalcpu = true
      report_active = true


    [[inputs.mem]]


    [[inputs.disk]]
      ignore_fs = [
        "tmpfs",
        "devtmpfs",
        "devfs",
        "iso9660",
        "overlay",
        "squashfs"
      ]


    [[inputs.diskio]]


    [[inputs.net]]

Sau đó output về VictoriaMetrics.

------------------------------------------------------------------------

# 23. Telegraf → vmauth → VictoriaMetrics

Ví dụ:

    [[outputs.influxdb]]
      urls = [
        "http://172.31.9.5:8427/write"
      ]

      username = "telegraf"
      password = "YOUR_TELEGRAF_PASSWORD"

      database = "victoriametrics"

      skip_database_creation = true

      exclude_retention_policy_tag = true

      content_encoding = "gzip"

Nhưng **endpoint chính xác phụ thuộc vmauth routing hiện tại của bạn**.

Ví dụ VictoriaMetrics single node nhận metrics ở:

    /write

và vmauth cần route:

    users:

      - username: "telegraf"
        password: "YOUR_TELEGRAF_PASSWORD"

        url_map:

          - src_paths:
              - "/write"

            url_prefix:
              - "http://127.0.0.1:8428/"

VictoriaMetrics documentation xác nhận `8427` là default port của vmauth
và `8428` của VictoriaMetrics single-node.

------------------------------------------------------------------------

# 24. Start Telegraf

    sudo systemctl enable telegraf
    sudo systemctl restart telegraf

Check:

    sudo systemctl status telegraf

Log:

    sudo journalctl -u telegraf -f

Test config:

    telegraf --test

Bạn sẽ thấy dạng:

    cpu,cpu=cpu-total,...
    mem,...
    disk,...
    diskio,...
    net,...

------------------------------------------------------------------------

# 25. Đừng bỏ qua monitoring cho chính collector

Đây là phần rất quan trọng khi bạn triển khai production.

Bạn hiện có:

    Node Exporter
    VictoriaMetrics
    Grafana

Do đó hãy monitor:

                    Collector
                       │
            ┌──────────┼──────────┐
            │          │          │
           CPU        RAM       Network
            │          │          │
            └──────────┼──────────┘
                       │
                       ▼
                 Node Exporter
                       │
                       ▼
                 VictoriaMetrics
                       │
                       ▼
                     Grafana

Ngoài host metrics, cần monitor chính collector:

### Vector

    events received
    events sent
    events discarded
    sink errors
    buffer utilization
    request duration

### Fluent Bit

    input records
    output records
    retry
    errors
    buffer
    memory

### Fluentd

    input
    output
    buffer queue
    retry
    flush
    errors

### Telegraf

    metrics gathered
    metrics dropped
    metrics written
    write errors

------------------------------------------------------------------------

# 26. Tôi khuyên bạn dùng disk buffer

Đặc biệt với Vector.

Ví dụ production:

    sinks:

      victorialogs:
        type: http

        inputs:
          - normalize_app
          - normalize_journal

        uri: "http://172.31.9.5:8427/insert/jsonline?_stream_fields=host,source&_msg_field=message"

        method: post

        auth:
          strategy: basic
          user: "vector_logs"
          password: "YOUR_VECTOR_LOGS_PASSWORD"

        encoding:
          codec: json

        framing:
          method: newline_delimited

        compression: gzip

        buffer:
          type: disk
          max_size: 10737418240
          when_full: block

        batch:
          max_bytes: 1000000
          timeout_secs: 2

        healthcheck:
          enabled: false

Tức là:

    Application
        │
        ▼
     Vector
        │
        ├── VictoriaLogs OK
        │       │
        │       └── gửi ngay
        │
        └── VictoriaLogs DOWN
                │
                ▼
           Disk buffer
                │
                ▼
           VictoriaLogs UP
                │
                ▼
           gửi lại

`data_dir` của Vector cũng được dùng để lưu state như file checkpoints
và disk buffers.

------------------------------------------------------------------------

# 27. Tôi đề xuất thứ tự triển khai thực tế

Đừng cài cả 4 cùng lúc.

Hãy triển khai theo thứ tự:

### Phase 1 --- Vector

    Application
        ↓
    Vector
        ↓
    vmauth
        ↓
    VictoriaLogs
        ↓
    Grafana

Xác nhận thành công.

------------------------------------------------------------------------

### Phase 2 --- Fluent Bit

    Application
        ↓
    Fluent Bit
        ↓
    vmauth
        ↓
    VictoriaLogs

Tạo field:

    collector=fluent-bit

------------------------------------------------------------------------

### Phase 3 --- Fluentd

    Application
        ↓
    Fluentd
        ↓
    vmauth
        ↓
    VictoriaLogs

Tạo:

    collector=fluentd

------------------------------------------------------------------------

### Phase 4 --- Telegraf

    Host
     ↓
    Telegraf
     ↓
    vmauth
     ↓
    VictoriaMetrics
     ↓
    Grafana

------------------------------------------------------------------------

# 28. Cuối cùng architecture của bạn sẽ thành

                                  Grafana
                        ┌────────────┼────────────┐
                        │            │            │
                        ▼            ▼            ▼
                 VictoriaLogs  VictoriaMetrics   Tempo
                        ▲            ▲            ▲
                        │            │            │
                      vmauth        vmauth        OTel
                        ▲            ▲
                        │            │
            ┌───────────┼────────┐   │
            │           │        │   │
            │           │        │   │
       Fluent Bit    Fluentd   Vector │
            │           │        │    │
            └───────────┴────────┘    │
                        │             │
                        │             │
                  Application       Telegraf
                  logs/journald    CPU/RAM/Disk/
                                   DB/Network

Và điều quan trọng là bạn có thể phân biệt trong VictoriaLogs:

    environment="lab"
    service="application"
    collector="vector"

hoặc:

    environment="lab"
    service="application"
    collector="fluent-bit"

hoặc:

    environment="lab"
    service="application"
    collector="fluentd"

Từ đó Grafana có thể tạo dashboard để **so sánh throughput, latency,
dropped logs, CPU/RAM của từng collector**.
