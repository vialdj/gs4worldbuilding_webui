FROM python:3

WORKDIR /usr/src/app

COPY . .

RUN apt-get -y update
RUN pip3 install -r requirements.txt
RUN git clone https://github.com/vialdj/gs4worldbuilding
RUN pip3 install -e ./gs4worldbuilding

EXPOSE 8000

CMD gunicorn wsgi:app